---
title: "PostgreSQL'de Açık Kilitleme"
description: "Deadlock için iki sıradan UPDATE yeterli. Satır kilitleri gerçekte ne yapar ve hangi transaction'ın öleceğine kim karar verir."
short: "Açık Kilitleme"
mediumUrl: https://medium.com/@mr-yakar/explicit-locking-in-postgresql-6ed90ddc7e16
---

## TL;DR

- Deadlock için iki düz `UPDATE` ifadesi yeterlidir. `40P01` almak için tek bir kilit yazmanız gerekmez.
- Tablo düzeyindeki kilit adları yanıltıcıdır: `ROW SHARE` ve `ROW EXCLUSIVE` **tablo** kilitleridir. Önemli olan yalnızca çakışma listesidir.
- **Düz bir `SELECT`'i yalnızca `ACCESS EXCLUSIVE` bloklar.** `ALTER TABLE`, `DROP`, `TRUNCATE` ve `VACUUM FULL`'u üretimde tehlikeli yapan budur; `CONCURRENTLY` ile indeks oluşturmayı güvenli yapan da.
- Satır kilitlerinin iki eksende dört modu vardır: paylaşımlı ya da dışlayıcı, anahtara dokunan ya da dokunmayan. Ortadaki ikisi, **yabancı anahtar kontrolleri sıradan güncellemeleri bloklamasın** diye vardır.
- **Satır kilitleri okuyucuları asla bloklamaz.** Yalnızca aynı satırdaki başka bir yazıcı bekler.
- Aynı `SELECT ... FOR UPDATE` yalıtım düzeyine göre farklı davranır: **Read Committed uyum sağlar, Repeatable Read** bir serileştirme hatasıyla **vazgeçer**.
- Buradaki deadlock, Java'dakiyle aynı sorundur: **döngüsel bekleme** ve aynı şekilde düzeltilir; tutarlı bir kilit sırası, SQL'de bu `ORDER BY id FOR UPDATE`'tir.
- **Kurban rastgele değildir.** Bekleyen her oturum, beklemeye başladıktan `deadlock_timeout` sonra tam olarak bir kez döngü kontrolü yapar ve o kontrolü çalıştıran kendini iptal eder. Zaman aşımı çok düşükse kontrolünüz döngü oluşmadan *önce* çalışır: aynı deadlock'un tespiti, yalnızca kimin zamanlayıcısının neye ayarlandığına bağlı olarak 0,2 sn ya da 10,0 sn sürdü.
- **Advisory lock'lar bir satırı değil, bir sayıyı kilitler.** Yeniden girilebilirdirler (reentrant) ve bir oturumun birini kaç kez tuttuğu `pg_locks`'ta görünmez.
- Oturum düzeyindeki bir advisory lock **`ROLLBACK`'ten ve bağlantı havuzuna geri verilmekten sağ çıkar.** "Bu işi yalnızca bir örnek çalıştırır" böyle sessizce başarısız olur.

> ***Bu yazıdaki her çıktının ortamı:***
>
> - *Intel Core i7–4700HQ (4 çekirdek / 8 thread, x86–64), 16 GB DDR3–1600*
>
> - *Ubuntu 26.04*
>
> - *PostgreSQL 18.6,* `autovacuum` *kapalı.*
>
> *Aşağıdaki her SQL senaryosu* ***article-examples*** *deposunda,* `postgres-explicit-locking/` *altında; adımlar numaralı, böylece iki ya da üç psql oturumunda kendiniz çalıştırabilirsiniz.*
>
> *Kaynak: [*[*github.com/…*](https://github.com/mryakar/article-examples/tree/master/postgres-explicit-locking)*]*

## İstemediğiniz Deadlock

İki hesap, iki transaction, iki yönde hareket eden para.

```sql
-- T1                                    -- T2
BEGIN;                                   BEGIN;
UPDATE ... SET balance-100 WHERE id=100;
                                         UPDATE ... SET balance-100 WHERE id=200;
UPDATE ... SET balance+100 WHERE id=200;  -- waits
                                         UPDATE ... SET balance+100 WHERE id=100;
```

`LOCK TABLE` yok, hiçbir türden açık kilit ifadesi yok; dört sıradan `UPDATE`. T1'in ikinci ifadesi bloklanıyor. Sonra T2 ikincisini çalıştırıyor ve veritabanı yanıt veriyor:

```bash
ERROR:  40P01: deadlock detected
DETAIL:  Process 1583 waits for ShareLock on transaction 760; blocked by process 1584.
         Process 1584 waits for ShareLock on transaction 761; blocked by process 1583.
HINT:  See server log for query details.
CONTEXT:  while updating tuple (0,1) in relation "accounts"
```

T2 iptal ediliyor. T1 uyanıyor, bitiriyor ve commit ediyor: `100 | Ali | 900.00`, `200 | Ayşe | 1100.00`.

Kimse kilit istemedi. Postgres yine de aldı.

### Kısaca

- İki satırda, ters sırayla iki `UPDATE`, deadlock için yeterlidir.
- Kodun hiçbir yerinde açık bir kilit yazılmadı.
- Postgres döngüyü tespit etti ve bir transaction'ı `40P01` ile iptal etti; diğeri commit etti.
- Hangisinin öldüğü ve neden, daha sonra.

## Sormadan Aldığınız Kilitler

Adlar yanıltıcıdır: `ROW SHARE` ve `ROW EXCLUSIVE` **tablo düzeyinde** kilitlerdir. Belgeler bunu doğrudan söyler: *"adı row sözcüğünü içerse bile bu kilit modlarının hepsi tablo düzeyinde kilitlerdir; kilit modlarının adları tarihseldir."* Ayrıca kendilerine ait bir davranışları da yoktur. Bir mod yalnızca **çakıştığı modların bir listesidir**: iki transaction aynı tabloda çakışan modları aynı anda tutamaz, geri kalan her şey çalışır.

```
lock mode                taken by
-----------------------  -------------------------------------------
ACCESS SHARE             SELECT
ROW SHARE                SELECT ... FOR UPDATE / FOR SHARE
ROW EXCLUSIVE            INSERT, UPDATE, DELETE
SHARE UPDATE EXCLUSIVE   VACUUM, ANALYZE, CREATE INDEX CONCURRENTLY
SHARE                    CREATE INDEX
SHARE ROW EXCLUSIVE      CREATE TRIGGER
EXCLUSIVE                REFRESH MATERIALIZED VIEW CONCURRENTLY
ACCESS EXCLUSIVE         DROP, TRUNCATE, VACUUM FULL, most ALTER TABLE
```

En üstteki üçü birbiriyle çakışmaz; dolayısıyla okuyucular, ekleyiciler ve güncelleyiciler tablo düzeyinde asla sıraya girmez; ikisi beklediğinde bu bir **satır** yüzündendir. Listenin öbür ucunda, **`ACCESS EXCLUSIVE` düz bir `SELECT`'i bloklayan tek moddur:**

```sql
T1: BEGIN; LOCK TABLE accounts IN ROW EXCLUSIVE MODE;
T2: SELECT count(*) FROM accounts;      -- does not wait
T2: INSERT INTO accounts ...;           -- does not wait

T1: BEGIN; LOCK TABLE accounts IN ACCESS EXCLUSIVE MODE;
T2: SELECT count(*) FROM accounts;      -- BLOCKED
```

Göçleri (migration) riskli yapan bu ikinci bloklamadır: ifade hızlı olabilir, ama önce kilidi edinmesi gerekir ve uzun süren bir sorgunun arkasında beklerken her yeni `SELECT` onun arkasında sıraya girer. İndeks oluşturma iki tarafı da gösterir: `CREATE INDEX` `SHARE` alır ve yazmaları durdurur; `CREATE INDEX CONCURRENTLY` `SHARE UPDATE EXCLUSIVE` alır ve durdurmaz, bunun bedeli iki tablo taraması ve transaction bloğu kullanamamaktır.

İlerideki iki bölüm için bir özellik önemli: **bir kilit transaction bitene kadar tutulur**, asla erken bırakılmaz.

### Kısaca

- Her ifade, istense de istenmese de tablo düzeyinde bir kilit alır.
- Adlar tarihseldir: `ROW EXCLUSIVE` bir tablo kilididir.
- Bir kilit modunun kendine ait bir davranışı yoktur; yalnızca bir çakışma listesi vardır.
- `SELECT`, `INSERT` ve `UPDATE` tablo düzeyinde çakışmaz.
- Düz bir `SELECT`'i yalnızca `ACCESS EXCLUSIVE` bloklar. DDL'i tehlikeli yapan budur.

## Bir Satırı Ayırmak: FOR UPDATE ve Üç Kardeşi

`SELECT ... FOR UPDATE` şu anlama gelir: bu satırı okuyorum, okuduğuma dayanarak yazacağım ve arada kimse onu değiştiremez. Kontrol-et-sonra-uygula (check-then-act) mantığının kilididir. Bu türden dört mod vardır, iki eksende: paylaşımlı ya da dışlayıcı, anahtara dokunan ya da dokunmayan.

```
            mode                what it reserves
            ------------------  ------------------------------------
shared      FOR KEY SHARE       only the key: no change, no delete
            FOR SHARE           the whole row, while I read it

exclusive   FOR NO KEY UPDATE   the row, except its key
            FOR UPDATE          the whole row
```

İki paylaşımlı mod bir arada bulunabilir; dışlayıcı bir mod hiçbir şeyle bir arada bulunamaz. `FOR UPDATE` dördüyle de çakışır, `FOR KEY SHARE` yalnızca `FOR UPDATE` ile.

Büyük bir sonuç kümesi üzerinde `FOR UPDATE` kullanmadan önce bir maliyet: satır kilidi bellekte tutulmaz. **Tuple'ın içine**, bir `UPDATE` ya da `DELETE`'in de yazdığı `xmax` alanına **yazılır**. Bir milyon kilitli satır, bir milyon tuple yazımı demektir; her biri WAL trafiği ve sonradan vacuum işi. Kilitler diskte olduğu için çarpılacak bir kilit tablosu sınırı yoktur. Bu, önceki yazının açık bıraktığı bir şeyi de yanıtlar: sıfır olmayan bir `xmax`, satırın silinmediği, yalnızca kilitlendiği anlamına gelebilir.

### Kısaca

- İki eksende dört mod: paylaşımlı ya da dışlayıcı, anahtara dokunan ya da dokunmayan.
- İki paylaşımlı mod bir arada bulunabilir; dışlayıcı bir mod hiçbir şeyle bir arada bulunamaz.
- Kontrol-et-sonra-uygula mantığı için olan `FOR UPDATE`'tir.
- Satır kilidi tuple'ın `xmax`'ına yazılır, dolayısıyla bir milyon satırın bedeli bir milyon yazımdır.

## Ortadaki Modlar Neden Var

`FOR KEY SHARE` ve `FOR NO KEY UPDATE` **yabancı anahtarlar** (foreign key) yüzünden vardır. Bir `customers` tablosu ve onun alt tablosu `orders` üzerinde üç transaction:

```sql
T1: BEGIN; INSERT INTO orders(customer_id, amount) VALUES (42, 100);
    -- the FK check takes FOR KEY SHARE on customers(42)
T2: BEGIN; UPDATE customers SET name = 'Ali Veli' WHERE id = 42;
    -- name is not a key -> FOR NO KEY UPDATE -> does NOT wait
T3: BEGIN; DELETE FROM customers WHERE id = 42;
    -- DELETE always takes FOR UPDATE -> WAITS
```

T2 beklemez, T3 bekler ve tek fark her birinin hangi moda ihtiyaç duyduğudur. Postgres modu neye dokunduğunuza bakarak seçer: bir yabancı anahtar kontrolü üst satırda `FOR KEY SHARE` alır; bir `UPDATE` bir anahtar sütununa dokunuyorsa `FOR UPDATE`, dokunmuyorsa `FOR NO KEY UPDATE` alır; bir `DELETE` ise her zaman `FOR UPDATE` alır.

Ortadaki modlar olmasaydı bir yabancı anahtar kontrolünün dışlayıcı olanı alması gerekirdi. `orders`'a yapılan her `INSERT` müşteri satırını kilitler ve o müşterinin adını değiştiren her istek onun arkasında sıraya girerdi; çok sayıda alt kaydın gösterdiği her satır için şemaya gömülü bir darboğaz.

### Kısaca

- Ortadaki modlar, yabancı anahtar kontrolleri sıradan güncellemeleri bloklamasın diye vardır.
- Bir alt tabloya yapılan `INSERT`, üst satırda `FOR KEY SHARE` alır.
- Anahtar olmayan bir `UPDATE`, `FOR NO KEY UPDATE` alır ve onunla çakışmaz.
- `DELETE` her zaman `FOR UPDATE` alır ve çakışır.
- Postgres modu dokunduğunuz sütunlardan seçer.

## Satır Kilitleri Okuyucuları Bloklamaz

T1, 100 numaralı satırı kilitler ve tutar. T2 ardından dört şey dener:

```sql
T2: SELECT * FROM accounts WHERE id = 100;     -- does not wait, returns 1000.00
T2: SELECT count(*) FROM accounts;             -- does not wait
T2: UPDATE accounts SET ... WHERE id = 200;    -- does not wait
T2: UPDATE accounts SET ... WHERE id = 100;    -- BLOCKED
```

Dördünden üçü beklemez. Kilitli satır, son commit edilmiş sürümüyle hâlâ okunabilir; önceki yazıda anlatılan MVCC. Bir kilit satırı *yazmak* için ayırır, dolayısıyla yalnızca dördüncü ifade bekler.

Dolayısıyla kilit ayrıntı düzeyi, çekişme ayrıntı düzeyidir. Bir milyon hesaplık bir tabloda 100 numaralı satırı tutmak, 100 numaralı satıra dokunan transaction'ları etkiler, başka hiçbir şeyi değil: aynı hesaptan yapılan iki ödeme sıraya konur, ki doğruluk bunu gerektirir; farklı hesaplardan yapılan iki ödeme ise asla karşılaşmaz.

### Kısaca

- `FOR UPDATE` ile kilitlenmiş bir satır, herhangi bir düz `SELECT` tarafından beklemeden hâlâ okunabilir.
- Tam taramalar etkilenmez; yalnızca aynı satırdaki bir yazıcı bekler.
- Kilit ayrıntı düzeyi çekişme ayrıntı düzeyidir: farklı müşteriler asla birbirine dokunmaz.

## Yalıtım Düzeyleri Boyunca FOR UPDATE

Bekleme üç düzeyde de aynıdır. Fark, diğer transaction commit ettikten *sonra* ortaya çıkar. T1 1000.00'lık bir bakiye okur ve anlık görüntüsünü (snapshot) tutar, T2 o satırı 500.00 yapar ve commit eder, T1 ardından onun üzerinde `SELECT ... FOR UPDATE` çalıştırır:

```
Read Committed    500.00, no error
Repeatable Read   ERROR:  could not serialize access
Serializable      ERROR:  could not serialize access
```

İki hata durumundaki tam mesaj `could not serialize access due to concurrent update`'tir.

Read Committed **uyum sağlar**: kazananı bekler, ardından *yeni* sürümü kilitler ve `WHERE` cümlesini ona karşı yeniden değerlendirir. Repeatable Read **vazgeçer**, çünkü anlık görüntüsü bütün transaction boyunca dondurulmuştur ve kendisine verilen satır, görmeyi kabul ettiği satır değildir.

Bu, önceki yazının öbür yönden gösterdiği bir davranışın kilitleme tarafıdır: Read Committed'da bir yarışı kaybeden `UPDATE ... WHERE balance > 500` koşulunu yeniden kontrol eder ve satır artık uymuyorsa onu sessizce atlar; bu yalnızca `UPDATE 0` olarak bildirilir. `FOR UPDATE` bunu önler. Serializable altında tersi geçerlidir: genellikle gereksizdir, çünkü SSI okuma-yazma bağımlılıklarını zaten izler ve üstüne kilit eklemek size hem beklemeyi *hem de* yeniden denemeleri verir.

### Kısaca

- Üç düzey de aynı şekilde bekler; kazanan commit ettikten sonra farklılaşırlar.
- Read Committed yeni sürümü kilitler ve `WHERE`'i yeniden değerlendirir. Hata yok.
- Repeatable Read ve Serializable bir serileştirme hatası verir. Yeniden denemeniz gerekir.
- Birini seçin: Read Committed'da kötümser kilitleme ya da Serializable'da iyimser yeniden deneme.

## Aynı Sorun: Döngüsel Bekleme

Şimdi açılıştaki sorunun cevabı. İki transaction satır kilitlerini ters sırayla aldı: T1 100 numaralı satırı kilitledi ve ardından 200'ü istedi, T2 200'ü kilitledi ve ardından 100'ü istedi. Her biri diğerinin ihtiyaç duyduğunu tutuyor ve hiçbiri erken bırakamıyor, çünkü bir satır kilidi transaction'ının sonuna kadar yaşar.

![Solda iki transaction kutusu, sağda iki satır kutusu. Düz oklar T1'in 100 numaralı satırı, T2'nin 200 numaralı satırı tuttuğunu gösteriyor. Kesikli oklar aralarında çaprazlanıyor; her transaction diğerinin tuttuğu satırı bekliyor. Ardından T2'nin kutusu soluklaşıyor ve bir hata satırında “deadlock detected (40P01)” yazıyor.](./deadlock-sql.gif)

*İki transaction de bir kilitten söz etmiyor. Kilitleri* `UPDATE` *ifadeleri aldı ve onları hangi sırayla aldıkları hatanın ta kendisi.*

Bu, iki Java thread'inin iki hesap üzerinde ters sırayla `synchronized` çağırmasıyla aynı arızadır: aynı döngü, aynı dört koşul, aynı çözüm. Deadlock bir veritabanı ya da dil sorunu değil, bir **kaynak sıralaması** sorunudur. Farklı olan tepkidir: PostgreSQL döngüyü tespit eder ve katılımcılardan birini iptal eder; JVM ise tespit eder, bir thread dump'ta yazdırır ve hiçbir şey yapmaz.

**Sıralama onu ortadan kaldırır.** Satırları sabit bir sırayla, tek bir ifadede kilitleyin:

```sql
SELECT id FROM accounts WHERE id IN (100, 200) ORDER BY id FOR UPDATE;
```

İki transaction de artık aynı yönde edinir ve ikincisi 100 numaralı satırda **hiçbir şey tutmazken** bloklanır:

![İki panel. Solda T1 önce 100'ü sonra 200'ü kilitlerken T2 önce 200'ü sonra 100'ü kilitliyor ve bir açıklama döngünün kapandığını söylüyor. Sağda iki transaction de önce 100'ü sonra 200'ü kilitliyor ve T2 ilk satırda hiçbir şey tutmadan duruyor.](./lock-ordering-sql.gif)

*Kaybeden ilk satırda bekler. Döngünün kapanabileceği ikinci bir kenar yoktur.*

Bu istatistiksel değil, yapısaldır: hiçbir şey tutmayan bir transaction beklenemez, dolayısıyla bekleme grafiği bir döngü içeremez.

**İlk sürpriz: sıralama her zaman yeterli değildir.** İki transaction aynı satırı `FOR SHARE` ile okur; çakışma yok, ikisi de başarılı. Sonra ikisi de `FOR UPDATE`'e yükseltmeye çalışır ve her biri diğerinin paylaşımlı kilidini bekler:

```bash
ERROR:  deadlock detected
CONTEXT:  while locking tuple (0,1) in relation "accounts"
```

Tek satır, aynı sıra, yine de deadlock. Sıralanacak bir şey yok, dolayısıyla çözüm moddadır: **satıra ilk dokunduğunuzda ihtiyaç duyacağınız en kısıtlayıcı kilidi alın.** `CONTEXT` satırına da dikkat edin: açılıştaki deadlock `while updating tuple` diyordu, bu `while locking tuple` diyor; bu da size çarpışmanın düz bir yazma mı yoksa açık bir kilit isteği mi olduğunu söyler.

**İkinci sürpriz: kurban rastgele değildir.** Olağan tavsiye, hangi transaction'ın iptal edileceğini tahmin edemeyeceğinizdir ve belgeler de buna katılır: sonuç *“tahmin edilmesi zordur ve ona güvenilmemelidir.”* Tavsiye doğru; ardındaki açıklama genellikle eksik.

`deadlock_timeout` **oturum başına** bir ayardır. Beklemeye başlayan bir oturum bir zamanlayıcı kurar. Zamanlayıcı tetiklendiğinde o oturum bekleme grafiğini dolaşır ve **bir döngü bulursa kendini iptal eder**. Sunucu adaylar arasında seçim yapmaz: kurban, döngü varken kontrolünü çalıştıran oturumdur.

Üç durum, her biri beş çalıştırma, her seferinde aynı deadlock:

```
deadlock_timeout       cycle forms          victim      detected in
T1        T2
--------  --------     ------------------   ---------   -----------
200 ms    10 s         before T1's check    T1   5/5     0.2 s
10 s      200 ms       before T2's check    T2   5/5     0.2 s
200 ms    10 s         AFTER  T1's check    T2   5/5    10.0 s
```

Üçüncü durumda 200 ms'lik zamanlayıcı T1'dedir ve fark eden o *değildir*. Kontrolü 200 ms'de çalıştı, döngü henüz var olmadığı için döngü bulamadı ve bir daha hiç çalışmadı; deadlock 300 ms'de oluştu ve T2'nin on saniyelik zamanlayıcısı tetiklenene kadar iki transaction'ı de tuttu.

Her bekleyen, bekleme başına **tam olarak bir kez** kontrol eder. Kaynak kod bunu gösteriyor: `ProcSleep`, `DEADLOCK_TIMEOUT`'u bekleme döngüsünden önce bir kez kurar ve bir daha kurmaz; döngünün içinde `CheckDeadLock` çalışır ve bayrak temizlenir. Nedeni maliyettir: *"kontrolü bir süre bekleyene kadar erteleyerek, oldukça pahalı olan deadlock kontrolü kodunu çoğu durumda çalıştırmaktan kaçınabiliriz."*

Dolayısıyla **`deadlock_timeout`'u düşürmek tespiti erkene değil, geçe alabilir.** Uygulamanız iki durumda da değişmez: hatayı yakalayın ve baştan yeniden deneyin; yeniden deneme listesinde `40001` ve `40P01` olsun.

### Kısaca

- Açılıştaki deadlock, iki satır kilidini ters sırayla almaktan kaynaklandı; döngüsel bekleme, iki hesabı kilitleyen iki Java thread'iyle aynı arıza.
- Kilit sıralaması onu yapısal olarak ortadan kaldırır: bekleyen, hiçbir şey tutmadan bekler.
- İki transaction aynı satırdaki paylaşımlı bir kilidi yükselttiğinde işe yaramaz. En kısıtlayıcı modu baştan alın.
- Kurban, döngü varken kontrolünü çalıştıran oturumdur. `deadlock_timeout`'u düşürmek tespiti geciktirebilir: 0,2 sn yerine 10,0 sn.

## Bir Satırı Değil, Bir Sayıyı Kilitlemek

Şimdiye kadarki her şey veriyi kilitledi. Advisory lock'lar bir **sayıyı** kilitler: `SELECT pg_advisory_lock(42)`. 42 numaralı satır da yok, 42 numaralı tablo da; 42'nin ne anlama geldiğini yalnızca uygulamanız bilir ve Postgres hiçbir şeyi zorlamaz.

Tek bir kalıp için vardırlar: **kümede bunu yalnızca bir örnek yapmalı.** Gecelik toplu iş (batch), outbox relay, iki kez çalışmaması gereken zamanlanmış iş. Flyway göç yapmadan önce bu türden bir kilit alır; ShedLock onun üzerine kurulmuştur. Önemli olan varyant, sıraya girmek yerine hemen dönen `pg_try_advisory_lock`'tur:

```sql
instance A:  SELECT pg_try_advisory_lock(42);   ->  t     -- runs the job
instance B:  SELECT pg_try_advisory_lock(42);   ->  f     -- skips, no wait
instance C:  SELECT pg_try_advisory_lock(42);   ->  f     -- skips, no wait
```

Akla gelen alternatif, bir `job_running` boolean'ı, üç açıdan daha kötüdür: her set ve unset yeni bir satır sürümü yazar ve şişmeyi (bloat) besler, daha yavaştır ve iş ortasındaki bir çökme bayrağı sonsuza dek `true` bırakır. Bir advisory lock, oturumu sona erdiğinde serbest bırakılır.

İki yaşam süresi vardır:

```sql
pg_advisory_lock(n)             -- session level
   released by   explicit unlock, or the session ending
   ROLLBACK      no effect: you still hold it
   unlock        required; N acquires need N releases

pg_advisory_xact_lock(n)        -- transaction level
   released by   end of transaction, automatically
   ROLLBACK      releases it
   unlock        not available, not needed
```

`ROLLBACK` satırı ölçülebilir:

```sql
A: BEGIN; SELECT pg_advisory_lock(77); ROLLBACK;
A: SELECT count(*) FROM pg_locks WHERE locktype='advisory';   ->  1
B: SELECT pg_try_advisory_lock(77);                           ->  f

A: BEGIN; SELECT pg_advisory_xact_lock(88); ROLLBACK;
A: SELECT count(*) FROM pg_locks WHERE locktype='advisory';   ->  0
```

Transaction geri alındı; oturum düzeyindeki kilit hâlâ tutuluyor. Belgeler bunu belirtir: oturum düzeyindeki istekler *“transaction semantiğine uymaz.”*

Bir sonraki bölüm için iki özellik daha önemli. Advisory lock'lar **yeniden girilebilirdir**: birini tutan bir oturum, arkasında sıraya girmiş başkaları olsa bile onu her zaman yeniden alır ve her edinme kendi bırakmasını gerektirir. Ve sayı **görünmezdir**:

```sql
A: SELECT pg_try_advisory_lock(42);  -> t
A: SELECT pg_try_advisory_lock(42);  -> t        -- same session, again

A: SELECT locktype, objid, mode FROM pg_locks WHERE locktype='advisory';
    locktype | objid |     mode
   ----------+-------+---------------
    advisory |    42 | ExclusiveLock              -- ONE row

A: SELECT pg_advisory_unlock(42);    -> t
B: SELECT pg_try_advisory_lock(42);  -> f        -- still held
A: SELECT pg_advisory_unlock(42);    -> t
B: SELECT pg_try_advisory_lock(42);  -> t        -- now it is free
```

İki kez tutulan bir kilit, bir kez tutulan bir kilitle aynı görünür ve veritabanına kaç bırakmanın beklemede olduğunu soramazsınız.

Belgelerden iki sınır. Advisory lock'lar normal kilitlerle, boyutu `max_locks_per_transaction` ve `max_connections` ile belirlenen sabit bir paylaşımlı bellek havuzunu paylaşır; dolayısıyla kullanıcı başına bir kilit eninde sonunda onu tüketir ve sunucu artık hiç kilit veremez hale gelir. Ve `SELECT pg_advisory_lock(id) FROM foo WHERE id > 12345 LIMIT 100` ifadesinde `LIMIT`'in fonksiyon çalışmadan önce uygulanacağı garanti değildir; böylece hiç niyet etmediğiniz ve hiç bırakmadığınız kilitler alabilirsiniz; `LIMIT`'i bir alt sorguya koyun. İlgili bir araç: bir advisory lock *bu işi bir örnek yapar* anlamına gelir; `SELECT ... FOR UPDATE SKIP LOCKED` ise *bu öğeyi bir işçi alır* anlamına gelir.

### Kısaca

- Bir advisory lock, sizin seçtiğiniz bir sayıyı kilitler; Postgres onun ne anlama geldiğini kontrol etmez.
- Kaybedenler sıraya girmek yerine o turu atlasın diye `pg_try_advisory_lock` kullanın.
- Oturum düzeyindeki bir kilit `ROLLBACK`'ten sağ çıkar. Transaction düzeyindeki çıkmaz.
- Yeniden girilebilirdirler ve `pg_locks` birinin kaç kez tutulduğunu asla göstermez.
- İş birden fazla transaction'a yayılmıyorsa `pg_advisory_xact_lock`'u tercih edin.

## Bağlantı Havuzunuzdaki Hayalet Kilit

Son iki özelliği bir bağlantı havuzuyla birleştirin. Bir istek oturum düzeyinde bir advisory lock alır, işini yapar ve bağlantıyı geri verir; arada da unlock, erken bir return, bir istisna ya da bırakmayı yolun dışına taşıyan bir yeniden düzenleme yüzünden kaçırılır.

```java
try (Connection c = pool.getConnection()) {
    if (tryAdvisoryLock(c, JOB_ID)) {
        runTheJob(c);
    }
}   // close() does NOT close the connection. It returns it to the pool.
```

HikariCP geri dönüşte temizlik yapar: açık bir transaction'ı geri alır ve `autoCommit`'i, yalıtımı ve salt okunur bayrağını sıfırlar. Sıfırlamadığı şey **oturum durumudur**: `DISCARD ALL` göndermez ve advisory lock oturum durumudur.

Tek bağlantılı bir havuz üzerinden, 18.6'ya karşı üç istek:

```sql
request #1 pid 2299  pg_try_advisory_lock(42) -> true  => RUNS THE JOB
request #2 pid 2299  pg_try_advisory_lock(42) -> true  => RUNS THE JOB
request #3 pid 2299  pg_try_advisory_lock(42) -> true  => RUNS THE JOB
round 1  pool OPEN    advisory lock rows: 1     (expected 1)
round 1  pool OPEN    outsider can take it: false (expected false)
round 1  pool CLOSED  advisory lock rows: 0     (expected 0)
```

![Tek bir bağlantı tutan bir bağlantı havuzu kutusu, backend_pid 2299, “never released” (hiç bırakılmadı) işaretli bir advisory lock rozetiyle. Üç istek satırının hepsi aynı pid'i gösteriyor ve hepsi true döndürüyor. Aşağıda havuzun dışındaki bir örnek false döndürüyor ve bir pg_locks satırı, tutma sayısı gösterilmeyen tek bir satır gösteriyor.](./advisory-ghost.gif)

*Üç isteğin hepsi için aynı backend süreci. Koruma her seferinde true döndürüyor ve sunucuda görebildiğiniz tek şey bir kilit satırı.*

Hasar iki yönde işler. **Dışa doğru:** başka hiçbir örnek o kilidi alamaz, dolayısıyla hepsinin koruduğu iş her yerde çalışmayı durdurur ve hiçbir şey hata bildirmez. **İçe doğru:** sızdıran örnek kendi korumasından geçer; 2 ve 3 numaralı istekler `true` aldı, çünkü advisory lock'lar yeniden girilebilir ve bu aynı oturum. "Yalnızca bir örnek" kontrolü gürültüyle başarısız olmadı; true döndürdü ve her çağrı bir referans sayacını artırdı; bu sayaç artık hiçbir isteğin sahip olmadığı bir bağlantıda üç unlock gerektiriyor.

Bu, bir thread havuzuna dönerken temizlenmeden bırakılan bir `ThreadLocal` ile aynı biçimdir: ait olduğu işten uzun yaşayan ve bir sonraki ilgisiz görev tarafından devralınan durumu taşıyan, havuzlanmış bir kaynak.

Teşhis zordur, çünkü `pg_locks` kilit bir kez de alınsa üç kez de alınsa tek bir satır gösterir. Yukarıdaki son satır en net işarettir: havuzu kapatın, kilit kaybolur; bu da kilidin kimsenin izlemediği bir oturuma bağlı olduğunu gösterir.

Çözüm, hiç unlock olmamasıdır. `pg_advisory_xact_lock`, başarısız olanlar dahil her yolda transaction'ın sonunda serbest bırakır; aynı üç istek bu durumda her seferinde `true` döndürür, havuz açıkken sıfır kilit satırı bırakır ve dışarıdan birinin kilidi almasına izin verir. İş gerçekten birkaç transaction'a yayılıyorsa, bırakma bir `finally` içine aittir; bağlantı geri dönüşünde `DISCARD ALL` de yedek güvence olarak.

### Kısaca

- Oturum düzeyindeki bir advisory lock, bağlantı havuza döndüğünde serbest bırakılmaz.
- Havuz autocommit'i ve yalıtımı sıfırlar, oturum durumunu değil.
- Diğer örnekler dışarıda kalır ve sızdıran örnek kendi korumasından geçer, çünkü kilitler yeniden girilebilirdir.
- Havuzlanmış bir thread'de kirli bırakılan bir `ThreadLocal` ile aynı hata.
- İş birkaç transaction'a yayılmıyorsa transaction düzeyinde advisory lock'lar kullanın.

## pg_locks'u Okumak

Bir şey takıldığında iki görünüm soruyu yanıtlar. Kimin beklediğiyle başlayın:

```
 pid  |        state        | wait_event_type |  wait_event
------+---------------------+-----------------+---------------
 1790 | idle in transaction | Client          | ClientRead
 1792 | active              | Lock            | transactionid
```

1792 numaralı süreç `wait_event_type = 'Lock'` ile `active` durumda: kurban. 1790 numaralı süreç `idle in transaction` durumunda: hiçbir sorgu çalıştırmıyor ve neden o. Bu durum buradaki en yararlı uyarı işaretidir, çünkü hiçbir iş yapılmıyor ve kilitler yine de tutuluyor. Sonra zincir, `pg_locks`'un kendisiyle birleştirilmesinden (tam sorgu depoda; iki taraf `waiting` ve `blocking` olarak adlandırılmış):

```
 waiting | blocking | requested_mode | held_mode     |   locktype
---------+----------+----------------+---------------+---------------
    1792 |     1790 | ShareLock      | ExclusiveLock | transactionid
```

`locktype`'a dikkat edin: bu bir satır kilidi değil. Bir satırı bekleyen bir transaction, **diğer transaction'ın kimliği** üzerinde bekliyor olarak kaydedilir; `transactionid` üzerinde, o transaction bittiğinde verilen bir `ShareLock`. Satır beklemelerinin `pg_locks`'ta asla satır olarak görünmemesinin nedeni budur.

Birleştirmeyi (join) yazmak zorunda değilsiniz:

```sql
SELECT pid, pg_blocking_pids(pid) AS blocking_pids
  FROM pg_stat_activity
 WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

```
 pid  | blocking_pids
------+---------------
 1792 | {1790}
```

Advisory lock'lar için `WHERE locktype = 'advisory'` onları listeler; önceki çekinceyle birlikte: satır oradadır, sayı değil.

**Bir kilit beklemesi varsayılan olarak sınırsızdır.** Belgeler, kilit arayan bir transaction'ın, deadlock tespit edilmediği sürece “çakışan kilitlerin bırakılmasını süresiz olarak bekleyeceğini” açıkça belirtir. `lock_timeout` yalnızca beklemeyi, `statement_timeout` bütün ifadeyi sınırlar. Göçler ilkini ister; böylece alamayacakları bir kilidin arkasında bir kuyruk oluşturmak yerine hızla başarısız olurlar.

### Kısaca

- Bekleyen bir oturum `wait_event_type = 'Lock'` gösterir; bloklayan `idle in transaction` gösterir.
- Satır kilidi beklemeleri satır üzerinde değil, `transactionid` üzerinde kaydedilir.
- `pg_blocking_pids()` size zinciri tek çağrıda verir.
- `pg_locks` bir advisory lock'un kaç kez tutulduğunu size söylemez.
- Kilit beklemeleri varsayılan olarak sınırsızdır. `lock_timeout` ayarlayın.

## Kötümser mi İyimser mi — Birini Seçin

İki tutarlı strateji vardır ve sorunların çoğu her birinin yarısını çalıştırmaktan kaynaklanır.

**Kötümser** olan; Read Committed, `SELECT ... FOR UPDATE` ve tutarlı bir kilit sırasıdır. Beklersiniz, ama bekleme öngörülebilirdir ve ele alınacak serileştirme hatası yoktur. Pek çok transaction'ın üzerinde çekiştiği bir bakiye için bu genellikle doğru cevaptır.

**İyimser** olan; Serializable, açık kilit yok ve `40001` ile `40P01` etrafında bir yeniden deneme döngüsüdür. Hiçbir şey beklemez, ama sıcak bir satır çok sayıda yeniden denemeye yol açabilir ve her transaction'ın iki kez çalıştırılması güvenli olmalıdır. Serializable, korumanız gerekeni kilitleyemediğiniz durumlar için seçenektir: henüz var olmayan satırlar arasındaki bir değişmez; orada yüklem kilitleri (predicate lock), `FOR UPDATE`'in yapamadığı işi yapar.

İkisini karıştırmak iki bedeli de ödetir: kilitleri beklersiniz *ve* serileştirme hatalarını ele alırsınız. Hangisini seçerseniz seçin transaction'ları kısa tutun, çünkü her açık transaction kilit tutar, deadlock penceresini genişletir ve temizliği bloklar.

İki sütuna da ait olmayan üçüncü bir seçenek var:

```sql
UPDATE accounts SET balance = ?, version = version + 1
 WHERE id = ? AND version = ?;
```

Hiçbir yerde kilit yok. Satırı okuyun, yeni değeri hesaplayın ve **yalnızca okuduğunuz sürüm hâlâ oradaysa** geri yazın. Güncelleme sıfır satırı etkilerse, başka biri sizden önce davranmıştır ve baştan başlarsınız.

Bu, SQL ile yazılmış compare-and-set'tir. Java'da aynı fikir donanımda var; o da bir sonraki yazının konusu.

### Kısaca

- Kötümser: Read Committed artı `FOR UPDATE` artı bir kilit sırası. Öngörülebilir bekleme, yeniden deneme yok.
- İyimser: Serializable artı `40001` ve `40P01` üzerinde bir yeniden deneme döngüsü. Bekleme yok, yeniden denemeler zorunlu.
- İkisini karıştırmak iki bedeli de ödetir. Her iki durumda da transaction'ları kısa tutun.
- Bir sürüm sütunu size hiç kilit olmadan compare-and-set verir.

## Kaynaklar

**PostgreSQL belgeleri**

- *13.3 Explicit Locking*
 [https://www.postgresql.org/docs/18/explicit-locking.html](https://www.postgresql.org/docs/18/explicit-locking.html)
- *13.2 Transaction Isolation* 
 [https://www.postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)
- *Lock Management* 
 [https://www.postgresql.org/docs/18/runtime-config-locks.html](https://www.postgresql.org/docs/18/runtime-config-locks.html)
- *Advisory Lock Functions (9.28.10)*
 [https://www.postgresql.org/docs/18/functions-admin.html](https://www.postgresql.org/docs/18/functions-admin.html)
- *pg_locks*
 [https://www.postgresql.org/docs/18/view-pg-locks.html](https://www.postgresql.org/docs/18/view-pg-locks.html)
- *SELECT — The Locking Clause* 
 [https://www.postgresql.org/docs/18/sql-select.html](https://www.postgresql.org/docs/18/sql-select.html)
