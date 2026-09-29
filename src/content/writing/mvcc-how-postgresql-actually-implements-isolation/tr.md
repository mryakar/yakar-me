---
title: "MVCC — PostgreSQL Yalıtımı Gerçekte Nasıl Uygular"
description: "Satır sürümleri, anlık görüntüler ve tek bir transaction'daki iki SELECT'in neden farklı sonuç verebildiği."
short: "MVCC"
mediumUrl: https://medium.com/@mr-yakar/mvcc-how-postgresql-actually-implements-isolation-6faddc9291ae
---

## TL;DR

- PostgreSQL'de `UPDATE` bir satırı asla yerinde değiştirmez. **Yeni bir satır sürümü** yazar ve eskisini ölü olarak işaretler. `DELETE` yalnızca işaretler. Tablonuzdaki satır sayısı diskteki tuple sayısı değildir.
- Her tuple `xmin` (onu oluşturan transaction) ve `xmax` (onu öldüren ya da kilitleyen transaction) taşır. Bu iki alan MVCC'nin çekirdeğidir.
- Bir **anlık görüntü** (snapshot) üç değerdir: `xmin`, `xmax` ve alındığı anda hâlâ çalışmakta olan transaction kimliklerinin listesi. Görünürlüğe her tuple için o anlık görüntüye göre karar verilir.
- Yalıtım düzeyleri ayrı özellikler değildir. **Farklı bir anlık görüntü politikasına sahip tek bir motordur**.
- **Read Committed** her ifade için yeni bir anlık görüntü alır. Bir çakışma yüzünden bekleyen bir `UPDATE`, ardından `WHERE` cümlesini yeni sürüme karşı yeniden kontrol eder.
- **Repeatable Read** bütün transaction için tek bir anlık görüntüyü dondurur. PostgreSQL'de bu, kirli okumaları, tekrarlanamayan okumaları **ve hayalet okumaları** önler; SQL standardının gerektirdiğinden daha güçlüdür. Geriye serileştirme anomalileri kalır.
- **Serializable** SSI ekler: yüklem kilitleri okuma/yazma bağımlılıklarını izler ve serileştirilemez bir sonuç üretecek transaction'ları iptal eder. **Yazma çarpıklığını** (write skew) yakalayan budur.
- Repeatable Read ve Serializable altında `could not serialize access` bir başarısızlık değildir. Sözleşmenin bir parçasıdır ve uygulamanız **yeniden denemek zorundadır**; bu da idempotentliği zorunlu kılar.
- Eski sürümler birikir. **VACUUM** onları geri kazanır; açık bir transaction xmin ufkunu geride tutmuyorsa. Tutuyorsa hiçbir şey temizlenemez.
- MVCC PostgreSQL'e özgü değildir, ama uygulamaları farklıdır. PostgreSQL eski sürümleri tablonun kendisinde tutar; Oracle ve InnoDB onları undo segmentlerinde tutar. Kilit tabanlı sistemler (2PL) okuyucuları yazıcılara karşı bloklar; MVCC bloklamaz.

> ***Bu yazıdaki her çıktının ortamı:*** *x86_64 üzerinde PostgreSQL 18.6 (Debian derlemesi), Docker içinde,* `autovacuum` *kapalı; böylece biz bakarken arka planda hiçbir şey temizlenmiyor. Sizin makinenizdeki transaction kimlikleri farklı olacaktır; yapı farklı olmayacaktır.*

## Anomalilerden Mekanizmaya

Daha önceki bir yazıda transaction'lar aynı anda çalıştığında neyin yanlış gidebileceğini anlatmıştım: **kirli okumalar**, **tekrarlanamayan okumalar** ve **hayalet okumalar** ve her birini hangi yalıtım düzeyinin önlediği. O yazı davranış düzeyinde kalmıştı: ne gördüğünüz ve hangi ayarın onu değiştirdiği.

Bu yazı altına iniyor. Buradaki soru *Repeatable Read hangi anomalileri önler* değil, *veritabanı onları imkânsız kılmak için gerçekte ne yapıyor*.

Cevap tek bir mekanizmadır: **Çok Sürümlü Eşzamanlılık Denetimi** (Multiversion Concurrency Control, MVCC). PostgreSQL'in sunduğu üç yalıtım düzeyi üç farklı algoritma değildir. Anlık görüntünün ne zaman alındığına dair farklı bir kurala sahip aynı motordur.

Başlamadan önce bir düzeltme. O önceki yazıda hayalet okumaları önlemek için Serializable'a geçmeniz gerektiğini yazmıştım. Bu SQL standardı için doğrudur. PostgreSQL için **doğru değildir** ve mekanizma ortaya konduğunda nedenini tam olarak göreceğiz.

Buradaki hiçbir şey Spring'e, `@Transactional`'a ya da uygulama katmanına dokunmuyor. İki `psql` oturumu ve bir tablo.

### Kısaca

- Önceki yazı her yalıtım düzeyinin *hangi* anomalileri önlediğini anlattı. Bu yazı *nasıl* önlediğini açıklıyor.
- PostgreSQL'in üç yalıtım düzeyi üç algoritma değildir. Farklı anlık görüntü kurallarına sahip tek bir motordur: **MVCC**.
- O önceki yazıya düzeltme: PostgreSQL'de hayalet okumaları önlemek için Serializable'a ihtiyacınız **yoktur**.

## UPDATE Güncellemez

Bir tabloyla başlayın:

```sql
CREATE TABLE accounts (id int primary key, owner text, balance numeric); 

INSERT INTO accounts VALUES 
(1, 'amo', 100), 
(2, 'simo', 250);
```

Şimdi bir satırı üç kez değiştirin:

```sql
UPDATE accounts SET balance = 90 WHERE id = 1; 
UPDATE accounts SET balance = 80 WHERE id = 1; 
UPDATE accounts SET balance = 70 WHERE id = 1;
```

İki satır girdi, üç güncelleme uygulandı. Tabloya kaç satırı olduğunu sorun:

```bash
visible_rows
--------------
            2
(1 row)
```

Şimdi *sayfaya* ne tuttuğunu sorun. `pageinspect` eklentisi ham heap'i okur:

```sql
CREATE EXTENSION IF NOT EXISTS pageinspect; 
SELECT lp, t_xmin, t_xmax, t_ctid 
FROM heap_page_items(get_raw_page('accounts', 0));
```

```bash
 lp | t_xmin | t_xmax | t_ctid
----+--------+--------+--------
  1 |    756 |    757 | (0,3)
  2 |    756 |      0 | (0,2)
  3 |    757 |    758 | (0,4)
  4 |    758 |    759 | (0,5)
  5 |    759 |      0 | (0,5)
(5 rows)
```

![Animasyon: tablonun satır sayısı ikide kalırken sayfadaki tuple sayısı ikiden beşe çıkıyor; her UPDATE önceki sürümü ölü olarak işaretleyip yeni bir tane ekliyor.](./update-versions.gif "Satır sayısı hiç değişmiyor. Sayfa büyümeye devam ediyor.")

Diskte beş tuple. Tabloda iki satır.

PostgreSQL'de bir `UPDATE` bir satırı değiştirmez. O satırın **yeni bir sürümünü** yazar ve eski sürümü ölü olarak işaretler. `DELETE` de hiçbir şeyi kaldırmaz. Yalnızca işaretler. Var olmuş her sürüm, bir şey gelip onu temizleyene kadar hâlâ sayfadadır.

Bu, ardından gelen her şeyin temelidir. İki transaction aynı satırı okuyup farklı değerler görebilir ve ikisi de haklıdır. Diskte tek bir “güncel değer” yoktur. Bir sürümler kümesi vardır ve her transaction'ın farklı birine hakkı vardır.

### Kısaca

- `UPDATE` **yeni bir satır sürümü** yazar ve eskisini ölü olarak işaretler. `DELETE` yalnızca işaretler.
- Bir satıra yapılan üç güncelleme, sayfada onun **dört sürümünü** bırakır. İki mantıksal satır, diskte beş tuple.
- Hiçbir yerde saklanan tek bir “güncel değer” yoktur. Bir sürümler kümesi vardır.
- `pageinspect` ham tuple'ları görmenizi sağlar: `heap_page_items(get_raw_page('accounts', 0))`.

## xmin ve xmax: Bir Satır Sürümü Nasıl İşaretlenir

Her tuple, doğrudan sorgulayabileceğiniz iki sistem sütunu taşır:

- `xmin` — bu sürümü oluşturan transaction'ın kimliği.
- `xmax` — onu ölü olarak işaretleyen transaction'ın kimliği. `0` hâlâ canlı demektir.

Eklemeden hemen sonra:

```sql
SELECT xmin, xmax, ctid, * FROM accounts ORDER BY id;
```

```bash
 xmin | xmax | ctid  | id | owner | balance
------+------+-------+----+-------+---------
  756 |    0 | (0,1) |  1 | amo   |     100
  756 |    0 | (0,2) |  2 | simo  |     250
(2 rows)
```

İki satır da 756 numaralı transaction tarafından oluşturuldu ve hiçbir şey onları öldürmedi. Üç güncellemeden sonra 1 numaralı satır şöyle görünür:

```bash
 xmin | xmax | ctid  | id | owner | balance
------+------+-------+----+-------+---------
  759 |    0 | (0,5) |  1 | amo   |      70
  756 |    0 | (0,2) |  2 | simo  |     250
(2 rows)
```

1 numaralı satır artık 759 numaralı transaction'ın oluşturduğu sürümdür. Bunu yukarıdaki ham sayfa çıktısıyla karşılaştırın, zinciri izleyebilirsiniz: 1. sürümü 757 öldürdü, o da 3. sürümü oluşturdu; onu 758 öldürdü, o da 4. sürümü oluşturdu ve böyle devam ediyor. `ctid` bir sürümün fiziksel adresidir: sayfa numarası ve öğe numarası.

**Terminalde kafanızı karıştıracak bir şey.** Sıfır olmayan bir `xmax` her zaman satırın silindiği ya da güncellendiği anlamına gelmez. Bir satır yalnızca **kilitlendiğinde** de ayarlanır:

```sql
-- session B
BEGIN;
SELECT id FROM accounts WHERE id = 1 FOR UPDATE;
```

```bash
 xmin | xmax | ctid  | id | balance
------+------+-------+----+---------
  759 |  760 | (0,5) |  1 |      70
  756 |    0 | (0,2) |  2 |     250
(2 rows)
```

760 numaralı transaction hiçbir şey yazmadı. Bir kilit tutuyor. Satır canlı ve canlı kalıyor.

Tuple başlığı farkı bilir ve size söyler. `HEAP_XMAX_LOCK_ONLY` bayrağı `t_infomask`'in 128 numaralı bitidir:

```sql
SELECT lp, t_xmax, (t_infomask & 128) != 0 AS xmax_is_lock_only
FROM heap_page_items(get_raw_page('accounts', 0))
WHERE lp = 5;
```

```bash
 lp | t_xmax | xmax_is_lock_only
----+--------+-------------------
  5 |    760 | t
(1 row)
```

Dolayısıyla `xmax`'ı "bu sürüm ölü" diye okumayın. Bu ayrımı tek başına `xmax` değil, bayrak bitleri taşır.

### Kısaca

- `xmin` = bu sürümü oluşturan transaction. `xmax` = onu öldüren ya da kilitleyen transaction; `0` canlı demektir.
- İkisi de sorgulayabileceğiniz sistem sütunlarıdır. `ctid` sürümün fiziksel adresidir (sayfa, öğe).
- **Sıfır olmayan bir** `xmax` **silindi demek değildir.** `SELECT ... FOR UPDATE` da onu ayarlar. Farkı tek başına `xmax` değil, `t_infomask`'teki `HEAP_XMAX_LOCK_ONLY` bayrağı taşır.

## Anlık Görüntüler ve Görünürlük Kuralı

Bir transaction bir satırın en yeni sürümünü görmez. **Anlık görüntüsünün** görmesine izin verdiği sürümü görür.

Bir anlık görüntü üç değerdir ve PostgreSQL onları size gösterir:

```sql
SELECT pg_current_snapshot();
```

```bash
 pg_current_snapshot
---------------------
 761:763:761
(1 row)
```

`xmin:xmax:xip_list` olarak okuyun:

- `xmin` **= 761** — bu kimliğin altındaki her transaction bitmiştir. Tek tek kontrol etmeye gerek yoktur.
- `xmax` **= 763** — bu kimlikten itibaren yukarıdaki her transaction, anlık görüntü alındığında başlamamıştı. Otomatik olarak görünmezdir.
- `xip_list` **= 761** — `xmin` ile `xmax` arasında olup **hâlâ çalışmakta olan** transaction'lar. Bir mikrosaniye sonra commit etseler bile yaptıkları görünmez kalır.

Yalnızca ortadaki aralık bir liste gerektirir. `xip_list`'in çoğu zaman boş olmasının nedeni budur. Çalışan transaction'ların hepsinin kimliği `xmax` ya da üstündeyse, ikinci kural onları zaten dışarıda bırakır.

![Animasyon: 761:763:761 anlık görüntüsü üç bölgeye ayrılmış bir sayı doğrusu olarak çiziliyor: bitmiş, sürmekte, başlamamış; ardından iki tuple ona göre sınanıyor, biri görünür biri görünmez.](./snapshot-visibility.gif "xmin'in altındaki her şey kesinleşmiş. xmax ve üstündeki her şey başlamamıştı. Yalnızca ortanın bir listeye ihtiyacı var.")

Şimdi her okumaya karar veren kural. Bir tuple'ın görünür olması için:

1. `xmin`'i **commit etmiş olmalıdır** ve anlık görüntü onu dışarıda bırakmamalıdır: `xip_list`'te olmamalı, `xmax` ya da üstünde olmamalı.
2. `xmax`'ı **onu geçersiz kılmamalıdır**: ya boş olmalı ya da commit etmemiş bir transaction'a ya da anlık görüntünün dışarıda bıraktığı bir transaction'a ait olmalı.

İki koşul, tuple başına, her okumada. MVCC görünürlüğünün tamamı budur.

Bir ayrıntı eksik ve önemli. Tuple'daki hiçbir şey 757 numaralı transaction'ın commit edip etmediğini söylemez. Tuple bir kimlik saklar. Commit durumu **commit günlüğünde** (`pg_xact`) yaşar. Bunu her okumada kontrol etmek pahalı olurdu, bu yüzden PostgreSQL biri ilk kez sorduğunda cevabı tuple'ın içine **ipucu bitleri** (hint bits) olarak geri yazar. Bir yazmadan sonraki ilk `SELECT`'in aynı veri üzerindeki ikincisinden daha yavaş olabilmesinin nedeni budur.

Mekanizma artık tamam: `xmin` ve `xmax` ile işaretlenmiş sürümler ve hangilerini görmenize izin verildiğine karar veren bir anlık görüntü.

Söylemediğimiz şey, anlık görüntünün **ne zaman** alındığı. Yalıtım düzeyleri arasındaki fark bu tek sorudur.

### Kısaca

- Bir anlık görüntü üç değerdir: `xmin:xmax:xip_list`. `xmin`'in altındaki her şey bitmişti; `xmax` ve üstündeki her şey başlamamıştı; `xip_list` arada kalıp hâlâ çalışanları tutar.
- Bir tuple, `xmin`'i **commit etmişse ve anlık görüntü onu dışarıda bırakmıyorsa**, **ve** `xmax`'ı **onu geçersiz kılmıyorsa** görünürdür.
- `xip_list` çoğu zaman boştur. Bu normaldir; `xmax` ve üstündeki çalışan transaction'lar ikinci kural tarafından zaten dışarıda bırakılır.
- Commit durumu tuple'da değildir. `pg_xact`'te yaşar ve **ipucu bitleri** olarak geri önbelleğe alınır; bir yazmadan sonraki ilk okumanın daha yavaş olabilmesinin nedeni budur.

## Yalnızca Postgres Değil: Eşzamanlılık Denetiminin İki Ailesi

Üç yalıtım düzeyine bakmadan önce bir adım geri çekilelim. MVCC bir PostgreSQL icadı değildir ve nerede durduğunu bilmek düzeyleri doğru okumanıza yardımcı olur.

Veritabanları eşzamanlı erişimi iki genel yoldan biriyle çözer.

**Kilit tabanlı aile.** **İki aşamalı kilitleme (two-phase locking, 2PL)** altında bir transaction okumak için paylaşımlı, yazmak için dışlayıcı bir kilit alır ve bunları bitene kadar tutar. Kural basit, bedeli yüksektir: **bir okuyucu bir yazıcıyı, bir yazıcı da bir okuyucuyu bloklar.** Doğruluk, çakışan transaction'ları birbirini bekletmekten gelir.

**Çok sürümlü aile.** MVCC altında bir yazma, bir okuyucunun kullandığı şeyi yok etmez, çünkü eski sürüm hâlâ oradadır. Dolayısıyla **okuyucular yazıcıları bloklamaz, yazıcılar da okuyucuları bloklamaz.** Düz MVCC'de iki transaction yalnızca ikisi de aynı satıra yazmak istediğinde çakışır.

MVCC'nin OLTP iş yüklerinde kazanmasının bütün nedeni budur. Uzun bir rapor bir tabloyu tararken çevresinde güncellemeler sürebilir ve hiçbir taraf beklemez.

Ama **MVCC bir spesifikasyon değil, bir stratejidir**. Hepsi MVCC olduğunu iddia eden sistemler en önemli kısımda farklılaşır: eski sürümlerin nerede tutulduğu.

- **PostgreSQL** eski sürümleri **tablonun kendisinde** tutar. Sayfada gördüğünüz buydu: iki satır için beş tuple. Yazması ucuz ve PostgreSQL'in **VACUUM**'a ihtiyaç duymasının nedeni.
- **Oracle** ve **MySQL/InnoDB** eski sürümleri tablodan ayrı **undo segmentlerinde** tutar ve önceki sürümleri gerektiğinde yeniden oluşturur. VACUUM yoktur, ama uzun bir okuma ihtiyaç duyduğu undo'dan uzun yaşayabilir; Oracle'ın `ORA-01555: snapshot too old` hatası tam olarak bu arızadır.
- **SQL Server** varsayılan olarak kilitleme kullanır ve yalnızca snapshot isolation'ı açtığınızda sürümlemeye geçer.
- **CockroachDB** ve **YugabyteDB** MVCC'yi dağıtık bir küme boyunca uygular; orada sürüm zaman damgalarının makineler arasındaki saat farklarından da sağ çıkması gerekir.

En uçta üçüncü bir cevap vardır: **transaction'ları hiç aynı anda çalıştırmayın.** VoltDB onları tek thread'li bölümlerde birbiri ardına çalıştırır. Tasarımı gereği doğrudur ve yalnızca transaction'lar kısa olduğunda pratiktir.

Bunun yazının geri kalanı için neden önemli olduğu: bundan sonraki her şey **PostgreSQL'in** uygulamasıdır. Yalıtım düzeyi adları standarttır. Arkalarındaki davranış değildir.

### Kısaca

- İki aile: okuyucuların ve yazıcıların birbirini blokladığı **kilit tabanlı (2PL)** ve bloklamadığı **çok sürümlü (MVCC)**.
- MVCC tek bir tasarım değil, bir stratejidir. Eski sürümlerin nerede yaşadığı, uygulamalar arasındaki temel farktır.
- PostgreSQL eski sürümleri **tabloda** saklar; VACUUM'a ihtiyaç duymasının nedeni budur. Oracle ve InnoDB bunun yerine **undo segmentleri** kullanır.
- SQL standardındaki yalıtım düzeyi adları ortaktır. Arkalarındaki davranış veritabanına özgüdür.

## Read Committed: Her İfade İçin Yeni Bir Anlık Görüntü

Bu PostgreSQL'in varsayılan düzeyidir ve kuralı tek bir cümledir: **her ifade taze bir anlık görüntü alır.**

Bu da aynı transaction'daki iki özdeş `SELECT`'in farklı cevaplar döndürebileceği anlamına gelir.

```sql
-- session A
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT balance FROM accounts WHERE id = 1;
```

```bash
balance
---------
      70
(1 row)
```

```sql
-- session B
UPDATE accounts SET balance = 999 WHERE id = 1;
COMMIT;
```

```sql
-- session A, same transaction
SELECT balance FROM accounts WHERE id = 1;
```

```bash
balance
---------
     999
(1 row)
```

Hiçbir şey bozuk değil. A'nın ikinci ifadesi yeni bir anlık görüntü istedi ve o zamana kadar B'nin transaction'ı commit etmişti, dolayısıyla görünürdü. Bu, önceki yazıdaki **tekrarlanamayan okumadır**, artık arkasında bir mekanizmayla: bir yarış değil, bir hata değil; yeni bir anlık görüntü.

**Neredeyse her yazının atladığı kısım.**

İfade düzeyindeki anlık görüntüler okumaları açıklar. Yazmaların bir kurala daha ihtiyacı vardır, çünkü bir yazıcı değiştirmek üzere olduğu satırdaki eşzamanlı bir değişikliği öylece yok sayamaz.

Bir `UPDATE`, commit edilmemiş başka bir transaction'ın zaten değiştirdiği bir satıra ulaştığında **bekler**. O transaction geri alınırsa güncelleme normal şekilde devam eder. Commit ederse PostgreSQL görmeden inanamayacağınız bir şey yapar: **`WHERE` cümlesini yeni sürüme karşı yeniden kontrol eder**.

```sql
-- balance is 1000
-- session A
BEGIN;
UPDATE accounts SET balance = 5 WHERE id = 1;   -- not committed yet
```

```sql
-- session B
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE balance > 500;
-- blocks, waiting for A
```

A oturumu commit eder. B uyanır ve koşulunu satırın şu anki haline karşı yeniden kontrol eder. `balance` 5'tir ve `5 > 500` yanlıştır:

```bash
UPDATE 0
```

Satır B başladığında eşleşiyordu ve artık eşleşmiyor, dolayısıyla B onu atlar. **Hata yok, uyarı yok, sıfır satır güncellendi.** Kodunuz güncellemenin uygulandığını varsaydıysa, artık yanlış ve sessiz.

Bu, değiştirmekte olduğunuz değerlere de bağlı olmayan `WHERE` cümleleri için ve doğruluk iş hacminden daha önemli olduğunda daha katı bir yalıtım düzeyi için en güçlü argümandır.

### Kısaca

- Read Committed her transaction için değil, **her ifade için yeni bir anlık görüntü** alır.
- Tek bir transaction'daki iki özdeş `SELECT` farklı değerler döndürebilir. Bu, düzeyin tasarlandığı gibi çalışmasıdır.
- Eşzamanlı bir yazmanın blokladığı bir `UPDATE` **bekler, ardından `WHERE` cümlesini** yeni sürüme karşı **yeniden kontrol eder**.
- Satır artık eşleşmiyorsa sessizce atlanır: `UPDATE 0`, hata yok.

## Repeatable Read: Transaction'a Hükmeden Tek Bir Anlık Görüntü

Tek bir sözcüğü değiştirin, mekanizma tamamen değişir. Repeatable Read altında anlık görüntü transaction'ın ilk ifadesinde **bir kez** alınır ve hiç tazelenmez.

```sql
-- session A
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM accounts;           -- 2
SELECT balance FROM accounts WHERE id = 1;  -- 100
```

```sql
-- session B
INSERT INTO accounts VALUES (3, 'new', 500);
UPDATE accounts SET balance = 777 WHERE id = 1;
-- both committed
```

```sql
-- session A, same transaction
SELECT count(*) FROM accounts;
SELECT balance FROM accounts WHERE id = 1;
```

```bash
 count
-------
     2
(1 row)

 balance
---------
     100
(1 row)
```

B'nin yaptığı commit edildi ve kalıcı. A onu göremez ve A bitene kadar görmeyecek. Anlık görüntü donmuştur.

**İşte önceki yazıya borçlu olduğum düzeltme.**

O `count(*)`'a tekrar bakın. B, A'nın sorgusuyla eşleşen bir satır ekledi ve A'nın ikinci sayımı hâlâ 2 döndürüyor. Bu bir **hayalet okumadır** ve gerçekleşmedi.

SQL standardında Repeatable Read'in hayalet okumalara izin vermesine izin verilir ve onları önlemek Serializable'ın işidir. Daha önce yazdığım buydu ve yazıların çoğunun tekrarladığı da bu. **PostgreSQL'de bu yanlıştır.** Burada görünürlüğe satır kilitleriyle değil, donmuş bir anlık görüntüyle karar verilir. Anlık görüntüden sonra oluşturulan bir satır, kaç kez bakarsanız bakın görünmezdir; satır olarak da, bir toplama işlevinin (aggregate) içinde de.

Resmî belgeler açıktır: PostgreSQL'in Repeatable Read'i, standardın tablosundaki serileştirme anomalileri dışındaki her olguyu önler. Standart bir **asgari** belirler. Daha fazlasını vermeye izin verilir.

**Dondurmanın size maliyeti.**

Donmuş bir anlık görüntü okurken sorun değildir. İşin ilginçleştiği yer yazmadır, çünkü bir transaction görmesine izin verilmeyen bir satır sürümünü değiştiremez.

```sql
-- session A                      -- session B
BEGIN ISOLATION LEVEL REPEATABLE READ;
UPDATE accounts
  SET balance = 200 WHERE id = 1;
                                  BEGIN ISOLATION LEVEL REPEATABLE READ;
                                  UPDATE accounts
                                    SET balance = 300 WHERE id = 1;
                                  -- blocks
COMMIT;
```

```bash
ERROR:  could not serialize access due to concurrent update
```

Bunu, B'nin beklediği ve ardından güncellemesini sessizce yeni sürüme uyguladığı Read Committed ile karşılaştırın. Repeatable Read reddeder. B'nin anlık görüntüsü `balance`'ın 100 olduğunu söylüyor. Diskteki satır başka bir şey söylüyor. Dürüstçe devam etmenin bir yolu yok, dolayısıyla transaction iptal edilir.

**Bu bir hata değil ve bir deadlock değil.** Düzeyin, sözünü tutamadığını size söylemesi ve kararı uygulamanıza geri vermesidir. Bu da düzgünce cevaplamamız gereken bir soruyu doğurur: kodunuz bu hatayla ne yapmalı?

### Kısaca

- Repeatable Read ilk ifadede **tek bir anlık görüntü** alır ve onu bütün transaction boyunca tutar.
- Diğer transaction'lardan gelen commit edilmiş değişiklikler, sizinki bitene kadar görünmez kalır.
- **PostgreSQL'in Repeatable Read'i hayalet okumaları da önler**; SQL standardının gerektirdiğinden daha güçlüdür. Yalnızca serileştirme anomalileri kalır.
- Çakışan bir yazma beklemez ve yeniden denemez. `could not serialize access due to concurrent update` ile başarısız olur.

## Serializable: Anlık Görüntüler Yetmediğinde

Donmuş bir anlık görüntü, *yanlış sürümü okumaya* dayanan her anomaliyi önler. Dokunamayacağı bir hata sınıfı vardır, çünkü orada hiçbir şey yanlış okunmaz.

İki doktor nöbette. Kural: en az biri kalmalı.

```sql
CREATE TABLE doctors (name text primary key, on_call boolean);
INSERT INTO doctors VALUES ('alice', true), ('bob', true);
```

İkisi de aynı anda, **Repeatable Read** altında, eve gitmek istiyor:

```sql
-- session A                        -- session B
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM doctors
  WHERE on_call;              -- 2
                                    BEGIN ISOLATION LEVEL REPEATABLE READ;
                                    SELECT count(*) FROM doctors
                                      WHERE on_call;              -- 2
UPDATE doctors SET on_call = false
  WHERE name = 'alice';
                                    UPDATE doctors SET on_call = false
                                      WHERE name = 'bob';
COMMIT;
                                    COMMIT;
```

İkisi de commit ediyor. Hata yok. Şimdi tabloya bakın:

```bash
name  | on_call
-------+---------
 alice | f
 bob   | f
(2 rows)
```

Nöbette kimse yok.

![Animasyon: iki transaction zaman çizelgesi; ikisi de nöbetteki doktor sayısını iki olarak okuyor, her biri farklı bir satırı güncelliyor, ikisi de commit ediyor ve tabloda nöbette kimse kalmıyor.](./write-skew.gif "İkisi de aynı koşulu okudu. İkisi de farklı bir satıra yazdı. MVCC'nin tespit edeceği hiçbir şey yok.")

**Her adım yasaldı.** Her transaction doğru bir anlık görüntü okudu, kuralı kontrol etti, iki doktor gördü ve birini çıkardı. **Farklı satırlara** yazdılar, dolayısıyla MVCC'nin tespit edeceği bir yazma çakışması yoktu. Her transaction kendi başına doğrudur, ikisi birlikte değildir.

Bu **yazma çarpıklığıdır** (write skew) ve anlık görüntü yalıtımının göremediği anomalidir. Nedeni yapısaldır. MVCC **yazmalar** arasındaki çakışmaları tespit eder. Burada çakışma, bir transaction'ın **okuduğu** ile diğerinin **yazdığı** arasındadır.

`SELECT ... FOR UPDATE` okunan satırları kilitleyerek bu özel durumu düzeltirdi. Ama bu, sorunu önce sizin fark etmenizi gerektirir; olabileceği her yerde.

**Serializable'ın ekledikleri.**

PostgreSQL'in Serializable'ı **SSI — Serializable Snapshot Isolation** (Serileştirilebilir Anlık Görüntü Yalıtımı) kullanır. Anlık görüntü mekanizmasını korur ve üstüne izleme ekler. Bir transaction okuduğunda PostgreSQL neyi okuduğunu, yalnızca satırları değil koşulları da, kaydeder. Bu kayıt bir **yüklem kilididir** (predicate lock), bir `SIREAD` kilidi olarak tutulur ve hiçbir şeyi bloklamaz.

Bu bilgiyle PostgreSQL **okuma/yazma bağımlılıklarını** izler: B transaction'ı A'nın okuduğu bir şeyi yazdı. Böyle bir bağımlılık zararsızdır. Bunların belirli bir örüntüsü, yani bir transaction'ın diğer ikisinin arasında hiçbir seri sıranın üretemeyeceği bir biçimde durması, zararsız değildir. PostgreSQL bu örüntüyü gördüğünde transaction'lardan birini iptal eder.

Aynı senaryo, tek sözcük değişti:

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
```

```bash
ERROR:  could not serialize access due to read/write dependencies among transactions
DETAIL:  Reason code: Canceled on identification as a pivot, during commit attempt.
HINT:  The transaction might succeed if retried.
```

Bu hatayı dikkatle okuyun. B'nin yazdığı satırla ilgili değil. **B'nin okuduğu ile A'nın yazdığı arasındaki bağımlılıkla** ilgili; dizinin hiçbir yerinde kilitleme, bekleme ya da bloklama olmayan bir çakışma. Veritabanı iki transaction'ın de tam hızla çalışmasına izin verdi ve ancak sonda, sonucun serileştirilebilir olmadığını kanıtlayabildiğinde reddetti.

**Pivot** sözcüğüne dikkat edin. B, tehlikeli örüntünün ortasındaki transaction'dır ve PostgreSQL ilk ya da son katılımcıyı değil, pivotu iptal eder.

Ve kural ayakta kalır:

```bash
name  | on_call
-------+---------
 alice | f
 bob   | t
(2 rows)
```

Alice eve gitti. Bob geri alındı ve hâlâ nöbette. Aynı iki transaction, aynı sıra, farklı tek bir anahtar sözcük.

Serializable bedava değildir. Okumaları izlemek bellek tüketir ve çekişme altında daha fazla iptal üretir. Ama size başka hiçbir düzeyin vermediği bir garanti verir: **transaction'ınız tek başına çalıştığında doğruysa, başkalarıyla birlikte çalıştığında da doğrudur.** Araya girme sıralamaları (interleaving) hakkında akıl yürütmeyi bırakırsınız.

Buna bağlı bir koşul var ve isteğe bağlı değil. O `HINT`, transaction'ın yeniden denenirse başarılı olabileceğini söylüyor; bu da birinin onu yeniden denemesi gerektiği anlamına geliyor.

### Kısaca

- Repeatable Read, bayat bir sürümü okumaktan kaynaklanan anomalileri önler. **Yazma çarpıklığı bunlardan biri değildir.**
- İki transaction aynı koşulu okuyabilir, **farklı satırlara** yazabilir, ikisi de commit edebilir ve birlikte bir değişmezi bozabilir.
- MVCC **yazma/yazma** çakışmalarını tespit eder. Yazma çarpıklığı ise ona görünmez olan bir **okuma/yazma** çakışmasıdır.
- Serializable **SSI** ekler: yüklem kilitleri neyin okunduğunu kaydeder ve tehlikeli bağımlılık örüntüleri commit anında bir iptale yol açar.
- İptal, mekanizmanın başarısız olması değil, çalışmasıdır ve uygulamanızın yeniden denediğini varsayar.

## Yeniden Denemek Zorundasınız. Bunun Başka Yolu Yok.

Daha katı iki yalıtım düzeyi de transaction'ınızı, sizin neden olmadığınız bir hatayla sonlandırabilir:

```bash
ERROR:  could not serialize access due to concurrent update
ERROR:  could not serialize access due to read/write dependencies among transactions
HINT:  The transaction might succeed if retried.
```

Bunları başarısızlık olarak ele almak, Repeatable Read ve Serializable ile yapılan en yaygın hatadır. **Bunlar başarısızlık değildir. Sözleşmenin bir parçasıdır.**

PostgreSQL'in sunduğu anlaşma şudur: bloklama olmadan tam hızla çalışın ve karşılığında bazı transaction'lara baştan başlamalarının söyleneceğini kabul edin. İlk yarıyı ikincisi olmadan alamazsınız. Serializable kullanan ve yeniden denemeyen bir sistem bedeli almış ve faydayı reddetmiştir.

**Hangi hatalar yeniden denenmeli.**

Yalnızca **SQLSTATE 40001** (`serialization_failure`) ve **40P01** (`deadlock_detected`) için yeniden deneyin. İkisi pratikte aynı anlama gelir: hiçbir şey yazılmadı, transaction temiz bir şekilde geri alındı ve yeniden çalıştırmak işe yarayabilir.

Kısıt ihlallerinde, sözdizimi hatalarında ya da bağlantı hatalarında yeniden denemeyin. Onlar yine başarısız olur.

```java
int attempt = 0;
while (true) {
    try {
        return doTransaction();
    } catch (SQLException e) {
        String state = e.getSQLState();
        if (!("40001".equals(state) 
        || "40P01".equals(state)) 
        || ++attempt >= MAX) {
            throw e;
        }
        Thread.sleep(backoffWithJitter(attempt));
    }
}
```

O döngüde üç ayrıntı önemli.

**Yeniden deneme transaction'ın dışında olmalıdır.** Geri alınmış bir transaction'a kaldığı yerden devam edilemez. Transaction'ın yaptığı her şey, uygulamanızın bellekte değiştirdiği her şey dahil, baştan yeniden yapılmalıdır.

**Geri çekilin ve rastgelelik (jitter) ekleyin.** Bir kez çakışmış iki transaction, ikisi de hemen yeniden denerse yine çakışır. Rastgele sapma olmadan yeniden denemeler sıraya dizilir ve çekişme kötüleşir.

**Denemelere sınır koyun.** Sonsuz bir yeniden deneme döngüsü geçici bir çakışmayı bir kesintiye dönüştürür.

**Yanlış yapması kolay olan kısım.**

Yeniden denemek, transaction gövdesinin birden fazla kez çalışabileceği anlamına gelir. Bu veritabanı işi için güvenlidir, çünkü geri alma onu geri aldı. Kodunuzun o bloğun içinde yaptığı başka hiçbir şey için güvenli değildir.

Bir e-posta göndermek, bir ödeme API'sini çağırmak, Kafka'ya yayımlamak, bir dosya yazmak, bellekteki bir sayacı artırmak; PostgreSQL bunların hiçbirini geri almaz. Transaction'ı üç kez yeniden deneyin, bir müşteriden üç kez ücret alabilirsiniz.

Dolayısıyla kural şudur: **transaction gövdesi idempotent olmalı ya da veritabanı işinden başka hiçbir şey içermemelidir.** Yan etkiler yeniden deneme sınırının dışına, ya bir idempotentlik anahtarının arkasına ya da aynı transaction içinde yazılıp sonradan işlenen bir outbox tablosuna aittir.

**Read Committed sizi bundan kurtarmaz.** Okumalar için serileştirme hatalarından kaçınır, ama kilitleri farklı sıralarla alan iki transaction arasındaki bir deadlock her yalıtım düzeyinde olabilir ve bu `40P01`'dir. Yeniden deneme mantığı yalnızca Serializable'ın derdi değildir.

### Kısaca

- `40001` ve `40P01` hata değil, **beklenen sonuçlardır**. Transaction'ın temiz bir şekilde geri alındığı ve yeniden çalıştırılabileceği anlamına gelirler.
- Yalnızca bu iki SQLSTATE'i yeniden deneyin. Kısıt ihlalleri ve sözdizimi hataları yine başarısız olur.
- Yeniden deneme, geri çekilme, **jitter** ve azami bir deneme sayısıyla **bütün** transaction'ı sarmalıdır.
- Transaction gövdesi birden fazla kez çalışacaktır. Veritabanı dışı yan etkiler (e-postalar, ödemeler, mesaj yayımlama) **idempotent** olmalı ya da yeniden deneme sınırının dışına taşınmalıdır.

## Fatura: Ölü Tuple'lar, Şişme ve VACUUM

MVCC'nin avantajı, yazıcıların okuyucuları asla bloklamamasıdır. Bedeli, her güncellemenin geride bir ceset bırakması ve birinin onu gömmek zorunda olmasıdır.

O biri **VACUUM**'dur.

Elli bin satır, bir kez güncellendi:

```sql
CREATE TABLE bloat (id int primary key, v int);
INSERT INTO bloat SELECT g, g FROM generate_series(1, 50000) g;
UPDATE bloat SET v = v + 1;
```

```sql
SELECT n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'bloat';
```

```bash
n_live_tup | n_dead_tup
------------+------------
      50000 |      50000
(1 row)
```

Elli bin canlı satır, elli bin ölü sürüm, hepsi aynı tabloda. Bu **şişmedir** (bloat): sorgularınızın hâlâ üzerinden okuyup geçmesi gereken sayfalar ve hâlâ parasını ödediğiniz disk.

O sorgu ilk başta sıfır döndürürse bir saniye bekleyin ve yeniden çalıştırın. Tablo istatistikleri her yazmada değil, kısa bir gecikmeyle boşaltılır.

VACUUM o ölü tuple'ları bulur ve alanlarını yeniden kullanılabilir olarak işaretler. **Autovacuum** bunu arka planda yapar. Varsayılan olarak ölü tuple sayısı tablonun %20'si artı 50 satırı geçtiğinde başlar.

**Gerçekten karşılaşacağınız arıza biçimi.**

VACUUM, açık bir transaction'ın hâlâ ihtiyaç duyabileceği ölü bir tuple'ı kaldıramaz. Sistemdeki en eski transaction bir taban belirler, **xmin ufku** (xmin horizon), ve onun üstündeki hiçbir şey temizlenemez.

Bir transaction açın, bir anlık görüntü alın, sonra başka bir yerden her satırı güncelleyin:

```sql
-- session A
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM bloat;    -- snapshot taken here
-- and then A just sits there
```

```sql
-- elsewhere
UPDATE bloat SET v = v + 1;
VACUUM (VERBOSE) bloat;
```

```bash
INFO:  vacuuming "mvcc.public.bloat"
INFO:  finished vacuuming "mvcc.public.bloat": index scans: 1
pages: 0 removed, 664 remain, 664 scanned (100.00% of total), 0 eagerly scanned
tuples: 0 removed, 100000 remain, 50000 are dead but not yet removable
removable cutoff: 784, which was 1 XIDs old when operation ended
```

**Sıfır kaldırıldı.** Elli bin tuple ölü, VACUUM hepsini buldu ve tek birine bile dokunmasına izin verilmiyor; çünkü A oturumunun anlık görüntüsü onlara hâlâ ihtiyaç duyabilir.

![Animasyon: açık bir transaction xmin ufkunu tutuyor, VACUUM sıfır tuple kaldırıyor; ardından transaction commit ediyor ve aynı VACUUM elli bin tuple kaldırıyor.](./xmin-horizon.gif "Açık anlık görüntü bir taban belirler. Onun üstündeki her ölü tuple, o oturum bitene kadar dokunulmazdır.")

Hattı kimin tuttuğunu görebilirsiniz:

```sql
SELECT pid, backend_xid, backend_xmin, now() - xact_start AS age
FROM pg_stat_activity
WHERE backend_xid IS NOT NULL OR backend_xmin IS NOT NULL;
```

```bash
pid | backend_xid | backend_xmin |       age
-----+-------------+--------------+-----------------
 521 |             |          785 | 00:00:00
 552 |             |          784 | 00:00:36.095027
(2 rows)
```

İkinci satır suçlu: otuz altı saniyedir açık ve `backend_xmin`'i 784'te tutuyor; bu da tam olarak VACUUM'un az önce bildirdiği sınır (cutoff).

O transaction'ı kapatın ve VACUUM'u yeniden çalıştırın:

```bash
tuples: 50000 removed, 66642 remain, 0 are dead but not yet removable
removable cutoff: 785, which was 0 XIDs old when operation ended
```

O tek oturumun bitmesi dışında hiçbir şey değişmedi.

**Hangi açık transaction'lar temizliği gerçekten bloklar.** Hepsi değil ve farkı, avlanmaya çıkmadan önce bilmeye değer.

- **Repeatable Read ya da Serializable** altındaki bir transaction, anlık görüntüsünü ilk ifadeden bitene kadar tutar. `backend_xmin`'de görünür ve açık kaldığı sürece, boştayken bile, temizliği bloklar.
- **Read Committed** altında bir şey **yazmış** bir transaction, açık bir transaction kimliği tutar. `backend_xid`'de görünür ve VACUUM sınırını onun ötesine taşıyamaz, dolayısıyla o da temizliği bloklar. Aksi halde boşta olan bir oturumda tek bir `UPDATE` yeterlidir:

```bash
-- while that session is open
tuples: 0 removed, 39999 remain, 19999 are dead but not yet removable

-- after it commits
tuples: 20000 removed, 20000 remain, 0 are dead but not yet removable
```

- **Read Committed** altında yalnızca **okumuş** bir transaction, ifadeler arasında anlık görüntü tutmaz. Böyle boşta bir transaction temizliği bloklamaz. Yine de kapatmaya değer, ama tablolarınızı şişiren o değildir.

Dolayısıyla tehlikeli örüntü kesindir: ya daha katı bir yalıtım düzeyi kullanan ya da zaten yazmış olan, uzun süren ya da boşta bir transaction. Böyle bir oturum ufku **bütün veritabanı** için dondurur ve şişen tablonun takılan sorguyla hiçbir ilgisi olmayabilir.

`idle_in_transaction_session_timeout` ayarlayın. `pg_stat_activity`'de `backend_xid` ve `backend_xmin`'i izleyin. Ve Repeatable Read ile Serializable'ın tasarımları gereği bunu kötüleştirdiğine dikkat edin: bütün transaction boyunca bir anlık görüntü tutarlar, dolayısıyla yavaş bir transaction Read Committed altında olacağından daha pahalıya mal olur.

**VACUUM'un yapmadığı bir şey.** Az önce elli bin ölü tuple'ı kaldırdı. Şimdi dosyaya bakın:

```sql
SELECT pg_size_pretty(pg_relation_size('bloat')) AS before_full;
VACUUM FULL bloat;
SELECT pg_size_pretty(pg_relation_size('bloat')) AS after_full;
```

```bash
before_full
-------------
 5312 kB

 after_full
------------
 1776 kB
```

Sıradan VACUUM alanı **o tablo tarafından yeniden kullanılabilir** hale getirdi ve dosyayı 5312 kB'de bıraktı. `VACUUM FULL` tabloyu yeniden yazdı ve diskin üçte ikisini geri verdi. Asıl sorun bunu nasıl yaptığında: dışlayıcı bir kilit alır ve yeniden yazma boyunca tablodaki diğer her şeyi bloklar. Büyük bir üretim tablosunda bu bir kesintidir; `pg_repack`'in var olmasının nedeni budur.

### Kısaca

- Her güncelleme ölü bir tuple bırakır. **VACUUM** o alanı geri kazanır; **autovacuum** bunu otomatik yapar.
- VACUUM, herhangi bir açık transaction'ın hâlâ ihtiyaç duyabileceği tuple'ları kaldıramaz. En eskisi **xmin ufkunu** belirler.
- Repeatable Read ve Serializable transaction'ları açıkken temizliği bloklar. Yazmış Read Committed transaction'ları de bloklar. Yalnızca okuyan, boştaki bir Read Committed oturumu bloklamaz.
- Böyle tek bir transaction, hiç dokunmadığı tablolarda bile, temizliği **veritabanı genelinde** durdurabilir.
- `idle_in_transaction_session_timeout` kullanın ve `pg_stat_activity`'de `backend_xid` ile `backend_xmin`'i izleyin.
- Sıradan VACUUM alanı yeniden kullanılabilir kılar ama dosyayı **küçültmez** (önce ve sonra 5312 kB). `VACUUM FULL` küçültür ve çalışırken dışlayıcı bir kilit alır.

## Bir Düzey Seçmek: Karar Kontrol Listesi

Mekanizma artık ortada. Bir düzey seçmek, birkaç soruyu dürüstçe cevaplamaya iner.

**1. Herhangi bir transaction bir değer okuyup ardından ona dayanarak yazıyor mu?**

Evetse Read Committed tehlikelidir. Bu `UPDATE ... SET x = x - 100`'ü, rezervasyon kontrollerini, bakiye kontrollerini ve "bu zaten var mı" kontrollerini kapsar. Daha önceki `UPDATE 0`'ı hatırlayın: satır sessizce eşleşmeyi bıraktı ve size hiçbir şey söylenmedi.

Hayırsa, yani yalnızca bağımsız değerler yazıyor ve gösterim için okuyorsanız, Read Committed uygundur ve daha ucuzdur.

**2. Doğruluk birden fazla satıra yayılan bir kurala mı bağlı?**

“Nöbette en az bir doktor.” “Bu bakiyelerin toplamı negatife düşmemeli.” “Çakışan iki rezervasyon olmamalı.”

Anlık görüntü yalıtımı bunları koruyamaz. Bu **yazma çarpıklığıdır** ve cevap Serializable, açık kilitleme ya da kuralı doğrudan zorlayan bir veritabanı kısıtıdır.

**3. Bir raporun birçok sorgu boyunca tutarlı bir görünüme ihtiyacı var mı?**

Repeatable Read. Tek anlık görüntü, zamanda tek bir an, her ifade diğerleriyle uyumlu. Transaction'ın ne kadar sürdüğüne dikkat edin; yavaş bir rapor xmin ufkunu tutar.

**4. Uygulamanız yeniden deneyebilir mi?**

Cevap hayırsa Repeatable Read ya da Serializable'ı güvenle kullanamazsınız. Dürüst çözüm, yeniden denemeyi mümkün kılmaktır; daha zayıf bir düzeye inip umut etmek değil.

**5. Başka bir veritabanına geçerseniz ne olur?**

Adlar standarttır. Davranış değildir. PostgreSQL'in Repeatable Read'i hayalet okumaları donmuş bir anlık görüntüyle önler. InnoDB düz `SELECT`'ler için kendi anlık görüntüsüyle benzer bir sonuca ulaşır, ama kilitleyen okumaları (`SELECT ... FOR UPDATE`, `UPDATE`, `DELETE`) bunun yerine en son commit edilmiş veriyi okur ve boşluk kilitlerine (gap lock) dayanır; dolayısıyla davranış tam da yazdığınız yerde farklılaşır. PostgreSQL'de Serializable SSI kullanır ve transaction'ları iptal eder; diğer sistemler kilit kullanır ve onları bunun yerine bloklar; aynı garanti, tamamen farklı arıza biçimi.

**Kodunuzun birden fazla motorda çalışması gerekiyorsa, anlamı taşıması için bir yalıtım düzeyi adına güvenmeyin.** Açık kilitlere, kısıtlara ya da uygulama düzeyindeki kontrollere güvenin.

**Sahip olmaya değer bir varsayılan.** Read Committed ile başlayın. Çiğneyemeyeceğiniz bir kural taşıyan belirli transaction'lar için Serializable'a geçin ve onları kısa tutun. Yalıtım düzeyi uygulama geneli değil, transaction başına bir ayardır.

**Bundan sonrası.** Buradaki her şey bir transaction'ın *neyi görmesine izin verildiğine* karar verir. Bazen bu yetmez. Bazen bir satıra dokunmadan önce onu ayırmanız ve diğer transaction'lara beklemelerini söylemeniz gerekir. Bu açık kilitlemedir: `SELECT ... FOR UPDATE`, advisory lock'lar ve onlarla gelen deadlock'lar. Bu da bir sonraki yazı.

## Kaynaklar

**PostgreSQL belgeleri**

- *Chapter 13: Concurrency Control*
 [https://www.postgresql.org/docs/current/mvcc.html](https://www.postgresql.org/docs/current/mvcc.html)
- *13.2 Transaction Isolation*
 [https://www.postgresql.org/docs/current/transaction-iso.html](https://www.postgresql.org/docs/current/transaction-iso.html)
- *Routine Vacuuming*
 [https://www.postgresql.org/docs/current/routine-vacuuming.html](https://www.postgresql.org/docs/current/routine-vacuuming.html)
- *System Columns* 
 [https://www.postgresql.org/docs/current/ddl-system-columns.html](https://www.postgresql.org/docs/current/ddl-system-columns.html)
- *pageinspect* 
 [https://www.postgresql.org/docs/current/pageinspect.html](https://www.postgresql.org/docs/current/pageinspect.html)
- *Transaction ID and Snapshot Information Functions*
 [https://www.postgresql.org/docs/current/functions-info.html](https://www.postgresql.org/docs/current/functions-info.html)
- *The Statistics Collector*
 [https://www.postgresql.org/docs/current/monitoring-stats.html](https://www.postgresql.org/docs/current/monitoring-stats.html)

**Diğer motorlar**

- MySQL Reference Manual, *Transaction Isolation Levels* 
 [https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)

**Arka plan okumaları**

- Hironobu Suzuki, *The Internals of PostgreSQL*
 [https://www.interdb.jp/pg/](https://www.interdb.jp/pg/)
- PostgreSQL Wiki, *Serializable Snapshot Isolation (SSI)* 
 [https://wiki.postgresql.org/wiki/SSI](https://wiki.postgresql.org/wiki/SSI)
- Michael J. Cahill, Uwe Röhm, Alan D. Fekete, *Serializable Isolation for Snapshot Databases* (SIGMOD 2008)
 [https://dl.acm.org/doi/10.1145/1376616.1376690](https://dl.acm.org/doi/10.1145/1376616.1376690)
- Martin Kleppmann, *Designing Data-Intensive Applications*, Bölüm 7

**Önceki yazı**

- [*Database Transactions and Spring’s Way of Managing Them* ](https://medium.com/havelsan/database-transactions-and-springs-way-of-managing-them-1ae30b8e6c5c?sharedUserId=mr-yakar)— anomaliler davranış düzeyinde anlatıldı ve hayalet okuma iddiası burada düzeltildi.
