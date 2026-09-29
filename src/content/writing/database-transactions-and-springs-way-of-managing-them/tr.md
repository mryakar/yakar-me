---
title: "Veritabanı Transaction'ları ve Spring'in Onları Yönetme Biçimi"
description: "Veritabanı transaction'larını ve Spring'in Transaction Yönetimini öğrenme zamanı."
short: "Transaction'lar ve Spring"
mediumUrl: https://medium.com/havelsan/database-transactions-and-springs-way-of-managing-them-1ae30b8e6c5c
---

## Giriş

Bu yazıda transaction'ın ne olduğunu tanımlayarak başlayacağız. Bugün bu, çeşitli profesyonel alanlarda yaygın olarak kullanılan bir kavram. Odağımız özellikle veritabanı transaction'ları. Tanımlarını, kullanım durumlarını ve temel özelliklerini inceleyeceğiz. Bu temel yönleri ele aldıktan sonra, transaction'ların başarıyla yürütülmesi için kritik olan A.C.I.D. ilkelerine dalacağız. Ardından, transaction davranışını belirlemede kilit rol oynayan yalıtım (isolation) ve yayılım (propagation) özelliklerini ele alacağız. Yazının sonunda, avantajları ve soyutlama mekanizması da dahil olmak üzere Spring Framework'te transaction yönetimine dair değerli bilgiler edinmiş olacağız. Son olarak, bir yazılım mühendisinin başarılı bir uygulama için gerekli en iyi uygulamalarıyla (best practices) bitireceğiz.

Transaction'lara aşina olmayan bir mühendis için bu yazı idealdir, çünkü en temelden başlıyor.

Bazı tanımlar koyarak başlayalım.

---

## Transaction Nedir?

[Cambridge](https://dictionary.cambridge.org/dictionary/english/transaction) Sözlüğü “transaction” için birden fazla tanım veriyor. İşte ilk ikisi:

> Birinin bir şey aldığı ya da sattığı bir durum.

> İş yapma süreci.

Veritabanları bağlamında odağımız veritabanı transaction'lardır. [Wikipedia](https://en.wikipedia.org/wiki/Database_transaction) veritabanı transaction'ını şöyle tanımlar:

> Bir veritabanı transaction'ı, bir veritabanı yönetim sistemi (ya da benzer bir sistem) içinde bir veritabanına karşı gerçekleştirilen ve diğer transaction'lardan bağımsız olarak tutarlı ve güvenilir biçimde ele alınan bir iş birimini simgeler. Bir transaction genellikle bir veritabanındaki herhangi bir değişikliği temsil eder.

Basitçe söylemek gerekirse transaction, ayrı ama birbirine bağlı görevlerin, pratikte tek bir birim gibi davranan bir toplamıdır. Birbirlerine dayanırlar; biri başarısız olursa hepsi başarısız olur. Veritabanı sistemlerinde bu birbirine bağlı görevlere transaction denir.

Transaction'ların iki ana amacı vardır;

1. Veritabanının tutarlılığını tehlikeye atmadan birden fazla görevi yönetmek ve hatalardan kurtulmak.
2. Yalıtımı koruyarak transaction'ların birbirini etkilemeden bağımsız olarak çalışmasını sağlamak.

Bu özellikler, transaction'ların uyması gereken ilkelere yol açar. Örneğin bir transaction ayrı bir iş birimi olduğu için atomik olmalıdır.

Bu ilkelerle devam edelim.

---

## A.C.I.D. İlkeleri

Bilgisayar biliminde ACID ilkeleri (Atomicity, Consistency, Isolation, Durability — Bölünmezlik, Tutarlılık, Yalıtım, Dayanıklılık), bütün transaction'ların korumak zorunda olduğu bir dizi özelliği ortaya koyar. Bu ilkeler; hatalar, donanım sorunları ya da veriyi veya veritabanı bütünlüğünü tehlikeye atabilecek diğer etkenler karşısında bile verinin geçerliliğini sağlar.

Kısaca, ACID ilkelerini karşılayan herhangi bir veritabanı eylemleri grubuna transaction denir.

Tanımları ve özellikleri tartışarak ilerlerken özgün bir SQL betiği kullanacağız. Senaryomuz, çok popüler bir film serisi olan Harry Potter'dan üç karakterin yer aldığı kurgusal bir senaryo. Her ilkeyi Harry, Hermione ve Ron ile birlikte inceleyeceğiz. Aşağıdaki SQL betiğini gözden geçirerek başlayalım.

```sql
DROP TABLE IF EXISTS Houses CASCADE;
CREATE TABLE Houses
(
    id BIGINT NOT NULL,
    name VARCHAR,
    CONSTRAINT houses_primary_key_constraint PRIMARY KEY (id)
);

INSERT INTO Houses(id, name) VALUES (1, 'Gryffindor');
INSERT INTO Houses(id, name) VALUES (2, 'Slytherin');
INSERT INTO Houses(id, name) VALUES (3, 'Ravenclaw');
INSERT INTO Houses(id, name) VALUES (4, 'Hufflepuff');

DROP TABLE IF EXISTS Wizards;
CREATE TABLE Wizards
(
    id       BIGINT  NOT NULL,
    name     VARCHAR NOT NULL,
    surname  VARCHAR NOT NULL,
    house_id BIGINT,
    CONSTRAINT wizards_primary_key_constraint PRIMARY KEY (id)
);

ALTER TABLE Wizards
    ADD CONSTRAINT 
      wizards_foreign_key_constraint_on_houses 
      FOREIGN KEY (house_id) REFERENCES Houses (id);
```

Bu betiğin Hogwarts'ın veritabanı sisteminde çalıştığını düşünün. Çalıştırılmasının ardından artık iki tablomuz var: Houses ve Wizards. Özünde, yeni büyücüleri Hogwarts'a kaydetmek için, onları büyücüler için ayırt edici bir grubu temsil eden belirli bir Hogwarts binasına atama seçeneğiyle birlikte, temel bir sistem kurduk.

Yeni büyücüleri kaydederken uymamız gereken belirli kısıtlarımız (constraint) da var. Bu kurallardan biri, iki büyücünün aynı kimlik numarasını paylaşamamasıdır. Bu temelle birlikte ilkelere daha derinlemesine dalalım.

### Bölünmezlik

Bir transaction'ın atomik doğasını yöneten ilkedir. Daha önce tartışıldığı gibi bir transaction, tek bir iş birimi olarak ele alınan görevlerden oluşur. Basitçe söylemek gerekirse, ya bir transaction'ın içindeki bütün alt görevler başarıyla yürütülür ya da hiçbiri veritabanını etkilemez. Özünde bu, ya hep ya hiç türünden bir eylemdir.

Aksi halde veri bütünlüğünü tehlikeye atabilir ve başarısız yürütülen bir alt görevin neden olduğu veri kaybına yol açabilir.

Bu ilkeyi biraz daha SQL betiği yazarak bir örnekle açıklayalım.

Harry, Hermione ve Ron'u Hogwarts'a kaydetme zamanı.

```sql
BEGIN;

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (1, 'Harry', 'Pother', 1);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (2, 'Hermonie', 'Granger', null);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (3, 'Ron', 'Weasley', null);

COMMIT;
```

Film serisinde görüldüğü gibi Harry, Hermione ve Ron ayrılmaz arkadaşlardır. Aralarındaki bağ çok önemlidir ve biri olmadığında iyi işlev göremezler. Dolayısıyla onları Hogwarts'a birlikte kaydetmeliyiz. Bu ya hep ya hiç senaryosudur; ya hepsi kaydedilir ya da hiçbiri.

Bu içten senaryoda bilgilerinin eklenmesi tek bir iş birimi olarak ele alınır ve bir transaction içinde gerçekleştirilmesi sağlanır. Bu transaction atomiktir ve bir bütün olarak tamamlanmasını garanti eder.

Transactional çalışmaya

```sql
BEGIN;
```

anahtar sözcüğüyle başlarız. Aynı eylemi yapmak için aşağıdaki varyasyonları da kullanabiliriz;

```sql
BEGIN WORK;
-- or
BEGIN TRANSACTION;
```

Ardından bilgilerini ekleriz;

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (1, 'Harry', 'Pother', 1);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (2, 'Hermonie', 'Granger', null);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (3, 'Ron', 'Weasley', null);
```

Harry bizim için özel bir yere sahip ve bu yüzden onu önce Hogwarts Binalarından birine atayacağız. Hermione ve Ron daha sonra atanacak.

Transaction'ı bitirmek için

```sql
COMMIT;
```

anahtar sözcüğünü kullanırız. Transaction'ı tamamlamak için aşağıdaki varyasyonları da kullanabiliriz;

```sql
COMMIT WORK;
-- or
COMMIT TRANSACTION;
```

Bu SQL betiğini bir hatayla çalıştıralım. Görevlinin Ron için kimlik numarası eklemeyi unuttuğu bir durumu canlandırmak için Ron'un kimlik numarasını null yapın.

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (null, 'Ron', 'Weasley', null);
```

Ron'un eksik kimlik numarası yüzünden SQL konsolunun bir hata verdiğini fark edeceksiniz. Sonuç olarak hiçbiri Hogwarts'a kaydedilmeyecek. Daha basit bir deyişle, hiçbirinin bilgisi veritabanına eklenmeyecek. Bunu tablolardaki satırları kontrol ederek doğrulayabilirsiniz.

Nihayetinde SQL ifademiz A.C.I.D.'in ilk ilkesine uyuyor: ‘Ya hepsi geçecek ya da hiçbiri geçmeyecek.’

### Tutarlılık

ACID'in bir diğer ilkesi, veritabanının tanımlı hiçbir kısıtı çiğnemeden bir tutarlı durumdan diğerine geçmesini sağlar. Özünde bir transaction veriyi geçersiz kılmamalı ya da veritabanında belirlenmiş herhangi bir kuralı ihlal etmemelidir. Örneğin benzersiz değerler saklayan bir sütunu olan bir tablo eklersek, her satırın kendine özgü bir değeri olmalıdır.

Aksi halde veritabanının ya da transaction'ın kendisinin içinde bir veri anomalisine yol açabilir ve amaçlanan iş mantığının doğru biçimde korunmasında bir başarısızlığa neden olabilir.

Ancak modern veritabanı sistemleri bu ilkeyi zorunlu kılmak için genellikle yerleşik çözümler sunar. Bu nedenle tanımlı bir kısıt mevcutken bu ilkeyi ihlal eden bir transaction'la karşılaşmak nadirdir. Bunu SQL kavramları ve betikleriyle açıklayalım.

Önceki örneğimizin üzerine inşa edelim. Hogwarts'a kaydolduktan sonra Harry, Hermione ve Ron'un her birinin kendine özgü bir kimlik numarası olacak. Bu protokol Hogwarts öğrenci yönetim sisteminde çok önemlidir. Ancak bu zorunlu gerekliliğin herhangi bir öğrenci kaydından önce oluşturulması gerekir. Bunu sağlamak için Wizards tablomuza zaten bir birincil anahtar (primary key) kısıtı uyguladık. Önceki örneğimize tekrar bakalım.

```sql
CREATE TABLE Wizards
(
    id       BIGINT  NOT NULL,
    name     VARCHAR NOT NULL,
    surname  VARCHAR NOT NULL,
    house_id BIGINT,
    CONSTRAINT wizards_primary_key_constraint PRIMARY KEY (id)
);
```

Basit transaction örneğimize geri dönelim. Bu sefer Hogwarts'ta büyücüleri kaydetmekten sorumlu görevli bir hata yapıyor ve Hermione ile Ron'a aynı kimlik numarasını veriyor. Ancak görevlinin başta Harry ve Hermione'yi kaydettiğini varsayalım. Bu sefer Ron'un kaydı ayrı bir SQL ifadesinde gerçekleşiyor, yani ilk transaction'ın dışında.

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (2, 'Ron', 'Weasley', null);
```

Başta belirlenen birincil anahtar kısıtı nedeniyle bir hata oluşacak ve Ron için yazılan ekleme ifadesi başarısız olacak. Nihayetinde bu, veritabanının tutarlılığını korur.

***Not:*** *PostgreSQL'de her ifade aslında örtük olarak*

```sql
BEGIN;
```

*ve*

```sql
COMMIT;
```

*ile sarmalanır. Bu, her bir ifadeyi transactional yapar.*

### Yalıtım

Bir projede kullanılan veritabanına çoğu zaman, her biri kendi mantığını yürüten birden fazla istemci ya da servis erişir. Bazen bu servisler aynı tablo üzerinde aynı anda çalışabilir. Bu da birden fazla transaction'ın eşzamanlı olarak çalışmasıyla sonuçlanır. Ancak bu, transaction'lar birbirinden yalıtılmadığı için veritabanından tutarsız biçimde veri çektikleri senaryolar yaratabilir. Daha basit bir deyişle birbirlerine karışırlar. Örneğin bir transaction bir değeri okurken başka bir transaction onu çoktan işlemiş olabilir ve bu da ilk transaction'ı verinin önceki sürümüyle baş başa bırakır. Bu tür senaryoların çeşitli örnekleri olabilir. Bu durumlar verinin güvenilirliğini tehlikeye atar. Bu tür yarış durumlarını (race condition) önlemek için transaction'ları birbirinden yalıtmak üzere tasarlanmış yaklaşımlar vardır.

Önceki kurgusal senaryomuzda Hogwarts'taki birden fazla görevlinin aynı anda yeni Büyücüler kaydettiğini hayal edin. Teknik terimlerle, kendi veritabanı transaction'larını paralel olarak yürütüyorlar.

Olası hatalı okumaların ayrıntılarına dalacak ve bu tür yanlış okumaları önleyen ilgili yalıtım düzeyini açıklayacağız.

**Kirli Okuma (Dirty Read):** Hogwarts'taki bir görevlinin veritabanındaki Binaların adlarını bir transaction olarak güncellediğini hayal edin.

```sql
BEGIN;

UPDATE Houses SET name = 'Powerpuff Girls' where id=1;
UPDATE Houses SET name = 'Avengers' where id=2;
UPDATE Houses SET name = 'Ninja Turtles' where id=30;
UPDATE Houses SET name = 'Snow white and other Dwarfs' where id=4;

COMMIT;
```

Diyelim ki ilk iki bina, Gryffindor ve Slytherin, henüz commit edilmemiş ya da tamamlanmamış bir transaction içinde Avengers ve Powerpuff Girls olarak güncellendi. İki güncelleme ifadesi hâlâ bekliyor. Bu arada başka bir görevli, Harry için mevcut Binaları listelemeye çalışıyor. Harry bir seçim yapmadan önce Binaların gerçek adlarını görmekte ısrar ediyor.

Görevli önce basit bir SELECT sorgusuyla Houses tablosundan veri çekiyor. Sonuç dört mevcut Binayı gösteriyor: Powerpuff Girls, Avengers, Ravenclaw ve Hufflepuff. Bunun nedeni, ikinci transaction'ın birinci transaction'ın commit edilmemiş değişikliklerini okumasıdır. Sonunda Harry, kişiliğine uygun olduğuna inandığı için Powerpuff Girls Binasına katılmak istediğini görevliye bildiriyor. Görevli de basit bir ekleme ifadesiyle Harry'nin kaydını tamamlıyor. Harry'nin kaydı artık tamamlanmıştır.

Unutmayın, ilk görevli ekleme betiğini hâlâ eşzamanlı olarak işliyor. Transaction'ın içinde bekleyen ifadeler olduğu için ilk transaction'ın başarıyla yürütüleceğine dair bir güvence yok.

SQL betiğimize tekrar bakarsak, üçüncü güncelleme ifadesinde Ravenclaw'ın kimlik numarası yanlışlıkla 3 yerine 30 yazılmış. Veritabanında kimlik numarası 30 olan bir Bina olmadığı için transaction bu noktada başarısız olacak ve daha önce tamamlanmış bütün commit edilmemiş değişikliklerin geri alınmasını (rollback) tetikleyecek. Sonuç olarak Harry'nin Binasının adı Gryffindor'a geri dönüyor. Harry ve onu Hogwarts'a kaydeden görevli bu durumdan habersiz. Ne yazık ki Harry sonunda Powerpuff Girls binasında olmadığını öğrenecek. Zavallı Harry.

SQL yürütmede ara sıra hatalar olması olağandır, ama şimdi ciddi bir sorunla karşı karşıyayız. İlk transaction başarısız oldu, dolayısıyla Houses tablosundaki veri değişmeden kaldı. Ancak ikinci transaction, ilk transaction başarısız olmadan önce değişiklikleri çoktan çekmişti ve Harry'nin bilgilerini veritabanına commit edecek.

Sonuç tutarsızdır, çünkü Harry tercihine ya da seçimine uymayan bir binaya atanmıştır.

Bu tatsız duruma **Kirli Okuma** (Dirty Read) denir.

Kirli Okuma, bir transaction başka bir transaction'dan commit edilmemiş veriyi okuduğunda gerçekleşir.

Özellikle birden fazla transaction'ın eriştiği veritabanlarında olasılığı çok yüksek bir senaryodur ve dikkate alınmalıdır.

İlk yalıtım düzeyimiz Read Uncommitted'dır ve en düşük düzeydir. Bu düzeyde, transaction'ların birbirlerinin commit edilmemiş değişikliklerini okumasına izin verdiği için Kirli Okumalar gerçekleşebilir.

Kirli Okumaları önlemek için Read Committed, Repeatable Read ya da Serializable gibi mevcut diğer yalıtım düzeylerinden birini seçmemiz gerekir.

---

**Tekrarlanamayan Okuma (Non Repeatable Read):** Diyelim ki Harry bir şekilde Binasının Powerpuff Girls olmadığını öğrendi ve buna epey üzüldü. Binasını değiştirmeye karar veriyor ve onu Hogwarts'a kaydeden görevliye gidip kibarca tercih ettiği bir Binaya geçmek istediğini söylüyor. Görevli, transactional bir biçimde, Harry'nin Binası hakkında ayrıntıları toplamak için Houses tablosunda bir select ifadesi çalıştırarak Harry için mevcut Bina adlarını kontrol ediyor.

```sql
SELECT * FROM Houses WHERE id=1;
```

Unutmayın, Harry'nin binasının kimlik numarası 1. İnceleme sonucunda ilgili Bina adının, Harry'nin sevmediği Gryffindor olduğunu görüyorlar ve görevli de mevcut adı beğenmiyor. Görevli, Harry'yi farklı bir Binaya atamak yerine doğrudan Binanın adını değiştirmeyi seçiyor. Üyelerin çoğu mevcut adı sevmediği için Gryffindor Binasındaki herkes bu karar sayesinde memnun olacak. Harry sabırsızca beklerken görevli hemen evrak işlerine başlıyor. Birlikte adı yeniden Powerpuff Girls'e döndürmeye karar veriyorlar.

Aynı anda, Harry ile ilk görevlinin ad değiştirme sürecini başlattığından habersiz başka bir görevli, Gryffindor'u Powerpuff Girls olarak değiştirmek için veritabanında bağımsız olarak bir güncelleme ifadesi çalıştırıyor. Bu eylem bir transaction olarak yürütülüyor ve başarılı oluyor; değişiklikler veritabanına commit ediliyor.

Belli bir noktada ilk görevli, ‘Gryffindor’da iki ‘f’ harfi mi yoksa bir mi olduğundan emin olamadığı için doğrulamak amacıyla önceki select ifadesini yeniden çalıştırıyor. Sonuç onu hayrete düşürüyor. Gryffindor'un çoktan Powerpuff Girls olarak değiştirildiğini görüyor. Harry'ye dönerek bunu mucizevi bir olaya, Binanın adının kendiliğinden değişmesine bağlıyor. Ancak bu bir mucize değil; Harry ve görevli yalnızca yanılıyorlar. Gerçekte az önce bir **Tekrarlanamayan Okuma** (Non-repeatable Read) hatası yaşadılar.

Basitçe söylemek gerekirse bu, bir transaction içinde bir satırı yeniden okumanın, aynı satır üzerinde aynı anda çalışan diğer transaction'ların eşzamanlı durumları nedeniyle farklı bir sonuç vermesiyle ortaya çıkan bir hatadır.

Bu senaryo oldukça olasıdır. Bunu önlemek için Read Uncommitted ve Read Committed'dan daha yüksek ve daha güvenli bir yalıtım düzeyi seçmeliyiz. Özellikle tekrarlanamayan okumaları önleyen Repeatable Read ya da Serializable gibi seçenekler seçilebilir.

---

**Hayalet Okuma (Phantom Read):** Zaman geçtikçe Harry, Hermione ve Ron'dan sıkılmaya başlıyor. Arkadaşlıkları iyi, ama Harry çevresini genişletmek ve özellikle kendi Binasında yeni arkadaşlar edinmek istiyor. Güvendiği görevliye, Harry'nin bütün tuhaf isteklerini karşılayan kişiye gitmeye karar veriyor. Harry görevliden Hogwarts'taki büyücüleri listelemesini istiyor. Bu isteğin ardından görevli Wizards tablosunda basit bir select sorgusu çalıştırıyor.

```sql
SELECT *
FROM Wizards
WHERE house_id = (SELECT house_id
                  FROM Wizards
                  WHERE name = 'Harry' AND surname = 'Pother');
```

Ne yazık ki sonucun yalnızca bir büyücü içerdiğini görüyorlar ve o da Harry. Bu onu üzüyor.

Aynı anda başka bir görevli, Draco Malfoy adında yeni bir büyücüyü Hogwarts'a kaydediyor. Draco, Harry'ye zorbalık etmeye hevesli olduğu için özellikle Powerpuff Girls binasına yerleştirilmek istiyor. Harry ile aynı Binada olmakta ısrar ediyor. Görevli, isteğini bir ekleme ifadesiyle, bunu bir transaction olarak ele alarak yerine getiriyor.

Harry'nin hayal kırıklığını gören, Harry'yi önemseyen görevlisi, küçük bir umut ışığına tutunarak veritabanını bir kez daha kontrol etmeye karar veriyor. Belki Harry, yine Powerpuff Girls binasında olan başka bir büyücüyle harika bir arkadaşlık bulur. Aynı transaction içinde aynı select ifadesini bir kez daha çalıştırıyor ve hemen şaşırıp kalıyor. Artık bir büyücü daha var. Heyecanla Harry'ye bu iyi haberi veriyor ve veritabanı sisteminin ne kadar güvenilmez olduğundan yakınıyor. Ancak yanılıyor. Az önce bir **Hayalet Okuma** (Phantom Read) hatası yaşadı.

Bu oldukça sık görülen bir senaryodur ve bu tür okuma sorunlarını önlemek için, özellikle bankacılık sistemlerinde, ele alınması son derece önemlidir.

Bunu ele almak için yalıtım düzeyini en yükseğe, yani Serializable'a çıkarmamız gerekir.

---

Bu, çok yerinde bir gözlem! En yüksek yalıtım düzeyini seçmek, bütün okuma sorunlarını çözecek nihai çözüm gibi görünüyor. Ancak bu her zaman böyle değildir. Veri tutarlılığı sağlasa da bunun bedeli performanstır. En düşük yalıtım düzeyinden en yükseğine doğru ilerledikçe, eşzamanlı sorgu yürütmeleri nedeniyle sorgu performansı önemli ölçüde düşer.

Daha iyi anlamak için aşağıdaki şekli inceleyin. Farklı yalıtım düzeyleriyle ilişkili okuma hatalarını gösteriyor.

| Yalıtım düzeyi | Kirli okumalar | Tekrarlanamayan okumalar | Hayalet kayıtlar |
|---|---|---|---|
| READ UNCOMMITTED | Evet | Evet | Evet |
| READ COMMITTED | Hayır | Evet | Evet |
| REPEATABLE READS | Hayır | Hayır | Evet |
| SERIALIZABLE | Hayır | Hayır | Hayır |

---

### Dayanıklılık

Bu son ilke, tamamlanmış bir transaction'dan sonra bile sistemin durumunun elektrik kesintisine, donanım arızalarına ya da veritabanı sisteminin düzgün çalışmasını engelleyen herhangi bir soruna rağmen bozulmadan kalmasını sağlar. Bu olmadan veri bozulması ya da kaybı yaşanabilir.

Voldemort Hogwarts'ın elektriğini kesse bile veritabanındaki veri etkilenmeden kalacak.

---

Sevgili okur, şimdiye kadar gerçekten çok iyi iş çıkardınız. Harry ve diğerleri sayesinde artık A.C.I.D. ilkelerini açıkça anlıyoruz. Şimdi edindiğimiz bu arka planın üzerine inşa ederek Spring'in Transaction Yönetimine dalalım.

---

## Asıl Kısım: Spring'in Transaction Yönetimi

Transaction'lar iki ayrı gruba ayrılır: küresel ve yerel transaction'lar. Bu kavram Spring'in Transaction Yönetiminde de benzer şekilde geçerlidir.

### Küresel Transaction'lar

Özünde küresel transaction'lar, birden fazla veritabanı ya da mesaj kuyruğu gibi birden fazla transactional kaynak üzerinde transactional eylemler gerçekleştirdiğinizde ortaya çıkar. Bu küresel transaction'lar JTA (Java Transaction API) kullanılarak ele alınır. Bu modelde bir uygulama sunucusu transaction yürütmesinin doğruluğunu denetler. Uygulamaların çoğunun transaction'ları tek bir kaynak üzerinde yürüttüğünü belirtmek önemlidir.

### Yerel Transaction'lar

Basitçe söylemek gerekirse, yerel transaction'lar tek bir kaynak üzerinde gerçekleştirilir. Küresel transaction'ların aksine bu model bir uygulama sunucusu içermez; bütün transaction'lar uygulamanın kendi içinde gerçekleşir. Programatik transaction yönetimi gibi başka yaklaşımlar da olsa da, bildirimsel (declarative) transaction yönetimiyle devam edeceğiz.

---

Çeşitli transaction yönetimi ayrıntılarına derinlemesine dalmayacağız, ama bu yapılandırmaların Spring'in Transaction Yönetimi kullanılarak kurulabileceğini not edin.

Küresel transaction'ları Spring kullanarak ele almak da mümkündür, ama burada ayrıntılarına girmeyeceğiz.

Unutmayın, transaction yönetimi gittikçe daha derine dalabileceğiniz derin bir kuyudur.

## Spring'in Transaction Yönetiminin Avantajları

Daha önce yerel ve küresel transaction'lara baktığımızda belirli dezavantajlar ortaya çıkmıştı. Örneğin uygulamanızı çalıştırırken ortam değiştirmek çok sayıda yapılandırmayı ayarlamayı gerektirebilir.

Spring'in Transaction Yönetimi, bütün mekanizmaları Spring'in kendi içinde ele alarak transactional eylemlerinizi herhangi bir ortamda yürütmenizi sağlayan temel mekanizmalar sunar.

Bildirimsel transaction yönetiminde, transactional yürütmeyi garanti etmek için sınıflarınıza ya da metotlarınıza yalnızca anotasyonlar eklersiniz. Bu daha basit ve Spring'in önerdiği bir yaklaşımdır.

Özünde, Spring'in Transaction Yönetim Sistemiyle harici bir transaction yöneticisi kullanmanız ya da transaction yöneticisini kendiniz yapılandırmanız gerekmez.

## Transaction'ları Servis Düzeyinde Yönetmek

Önerilen yöntem olduğu için bildirimsel transaction yönetimiyle devam edeceğiz. Spring'de bildirimsel transaction yönetimi, Proxy Deseninin (Proxy Pattern) uygulanmasıyla gerçekleştirilir. İlerideki bölümleri kavramak için Proxy Desenini iyi anlamak faydalı olur. Bu bilgiyi edinmek için yazılarımdan [birini](https://medium.com/havelsan/spring-framework-beans-full-mode-and-lite-mode-6a16fae20149) okuyabilirsiniz. Yalnızca Proxy Desenine odaklanmasa da ilgili kısımlarını okumak sizi ilerideki içeriğe hazırlayacaktır. Alternatif olarak internette inceleyebileceğiniz çok sayıda kaynak var.

**@Transactional** adında bir anotasyon var. Transactional bir durumu bildirmek için onu sınıf düzeyinde, metot düzeyinde ya da interface'lerde (Spring Framework 5.0'dan beri) kullanabiliriz. Arayüzlerle başlayalım;

```java
public interface Service { 
  
  void update(EntityModel entityModel);

  void deleteById(Long id);

}
```

Servis katmanında, önceki interface'i gerçekleyen ‘Service Implementation’ adında bir sınıf düşünün. **@Transactional** anotasyonunu interface tanımı üzerinde ya da interface'te belirtilen bir metot üzerinde kullanabiliriz.

```java
@Transactional // Option 1
public interface Service { 
  
  @Transactional // Option 2
  void update(EntityModel entityModel);

  void deleteById(Long id);

}
```

Bu yaklaşımla interface'teki bütün metotlar ya da interface'te **@Transactional** ile işaretlenmiş metotlar proxy tarafından yakalanır ve sonunda transactional hale gelir.

Spring Framework'ün önceki sürümlerinde interface'leri **@Transactional** ile işaretlemek mümkün değildi. Spring Framework 5.0 ile uygulanabilir hale geldi. Ancak bu, servis katmanını transactional yapmanın önerilen yolu değildir.

Java anotasyonları interface'lerden kalıtılmaz. AspectJ kullanılan durumlarda bu anotasyonlar göz ardı edilebilir. Bu durum, siz farkında olmadan transactional olmayan bir iş mantığına yol açabilir ve bu yüzden ideal bir seçim değildir.

Öte yandan **@Transactional** anotasyonunu sınıf düzeyinde kullanabilirsiniz. Şimdi bu senaryo için aşağıdaki kod parçasına bakalım;

```java
@Service
@Transactional
public class ServiceImplementation implements Service {

  // Assume that the implementations are completed.

  @Override
  public void update(EntityModel entityModel) {
    // ...
  }

  @Override
  public void deleteById(Long id) {
    // ...
  }

}
```

Burada sınıf, Service interface'indeki bütün metotları gerçekliyor, ama bu sefer **@Transactional** anotasyonu sınıf düzeyinde uygulanıyor. public, protected ya da paket görünürlüğüne sahip erişim belirleyicileri olan bütün metotlar proxy tarafından yakalanır. Ancak interface'lerden gelen metotlar public erişim belirleyicisini kullanmak zorundadır.

Ancak bir metot üst sınıf(lar)dan kalıtılmışsa, üst sınıfta zaten işaretlenmiş olsa bile, transactional hale gelmesini sağlamak için metodu **@Transactional** anotasyonuyla yerel olarak yeniden bildirmek gerekir. İş mantığını transactional yapmak için tercih edilir bir yaklaşım olsa da, kalıtılan metotları yeniden bildirmeyi unutup, olmayacakları halde transactional olacaklarını varsayabileceğiniz için hâlâ en iyi yaklaşım değildir.

Bir seçenek daha var. Aşağıdaki kod parçasına bakalım;

```java
@Service
public class ServiceImplementation implements Service {
  
  // Assume that the implementations are completed.
  
  @Transactional
  @Override
  public void update(EntityModel entityModel) {
    // ...
  }

  @Transactional
  @Override
  public void deleteById(Long id) {
    // ...
  }

}
```

Bu yaklaşım daha güvenlidir, çünkü iş mantığının bir kısmını transactional yapmayı unutma olasılığı daha düşüktür.

Bu yaklaşımları bir arada kullanmak da mümkündür. Örneğin **@Transactional**'ı aynı anda hem sınıf düzeyinde hem metot düzeyinde kullanabilirsiniz. Bu varsayılan bir transactional durum oluşturur ve belirli bir metot için özel bir durum tanımlayabilirsiniz.

**Not:** Varsayılan proxy yaklaşımının doğası gereği, Service Implementation sınıfı (**@Transactional** ile işaretlenmiş sınıf) içindeki çağrılar, çağrılan metot **@Transactional** olarak işaretlenmiş olsa bile proxy tarafından yakalanmaz.

---

## Spring'de Transaction'ların Yayılım Düzeyleri

Transactional bir eylem; transactional olma kapsamı, kısmi transaction, transactional olmama vb. dahil olmak üzere farklı transaction yapılandırmalarına ihtiyaç duyabilir. Bu tür durumlar yayılım düzeyleriyle ayarlanır.

Neyse ki Spring, çeşitli transaction senaryoları için pek çok yayılım düzeyi sunar. Bu, **@Transactional** anotasyonunun propagation adlı bir parametresiyle belirlenir;

```java
@Transactional(propagation = ...)
```

Şimdi onları tek tek inceleyelim;

### REQUIRED

Spring bu yayılım düzeyini varsayılan olarak kullanır. Bu düzeyde Spring aktif bir transaction olup olmadığını kontrol eder. Varsa mevcut eylem bu transaction'ın içinde olur. Transaction yoksa Spring mevcut eylem için bir tane oluşturur.

### REQUIRES_NEW

Aktif bir transaction varsa Spring onu askıya alır ve yeni bir tane oluşturur. Bu, özellikle kendi transaction'ını gerektiren iç içe eylemler olduğunda anlamlıdır.

### SUPPORTS

Bu yayılım düzeyi REQUIRED yayılım düzeyine benzer. Aktif bir transaction varsa mevcut eylem onu kullanacaktır. Ancak transaction yoksa mevcut eylem transactional olmayan biçimde yürütülecektir.

### MANDATORY

Bu yayılım düzeyi de REQUIRED yayılım düzeyine benzer. Aktif bir transaction varsa mevcut eylem onu kullanacaktır. Ancak yoksa bir istisna fırlatacaktır.

### NEVER

Yayılım düzeyinin adından da anlaşılacağı gibi hiçbir transaction'a izin verilmez. Aktif bir transaction varsa Spring bir istisna fırlatır.

### NOT_SUPPORTED

NEVER yayılım düzeyine benzer. Yine hiçbir transaction'a izin verilmez. Ancak Spring bunu sessizce ele alır. Aktif bir transaction varsa askıya alınır ve eylem transactional olmayan biçimde yürütülür.

### NESTED

Bu düzeyde Spring aktif bir transaction olup olmadığını kontrol eder ve varsa oraya bir kayıt noktası (save point) koyar. İş mantığında bir istisna oluşursa Spring mevcut eylemi kayıt noktasına geri alır (rollback).

---

## Spring'de Transaction'ların Yalıtım Düzeyleri

Transaction'lar, eşzamanlı diğer transaction'ların arasında başarıyla yürütülmek için farklı düzeylerde yalıtıma ihtiyaç duyar. Daha önce belirtildiği gibi, eşzamanlı yürütme sorunlara yol açabilir. Ancak Spring'de yalıtım düzeyini yapılandırmak basittir; **@Transactional** anotasyonunun bir başka parametresidir.

```java
@Transactional(isolation = ...)
```

### DEFAULT

Bu, Spring'deki transaction'lar için varsayılan yalıtım düzeyidir. Spring bir transaction başlattığında, transaction'ın yalıtım düzeyi veritabanının varsayılan yalıtım düzeyiyle aynı olur. Örneğin PostgreSQL'in varsayılan yalıtım düzeyi READ COMMITTED'dır. Bu düzeyi kullanırken dikkatli olmak önemlidir, çünkü veritabanını değiştirmek sorunlara yol açabilir.

Düzeylerin geri kalanı, daha önce yalıtım ilkesi bölümünde belirtildiği gibidir.

## En İyi Uygulamalar

Bu noktaya kadar bu yazıyı okuduğunuzu, ek araştırma yaptığınızı ve umarım pratik de yaptığınızı varsayarak, bahsetmeye değer olduğuna inandığım bazı en iyi uygulamalar var.

### İç İçe Transaction'lar

Zaman zaman iş mantığınızı iç içe transaction'larla yapılandırmanız gerekebilir. Böyle durumlarda yayılım düzeylerini dikkatle değerlendirmek çok önemlidir. Örneğin bir transaction'ın dıştaki transaction'dan bağımsız olarak yürütülmesine ihtiyaç duyabilirsiniz. Bu senaryoya dikkat edin.

### Transaction'larda Entity'leri Değiştirmek

Entity'leriniz için JPA kullanırken, bir entity'yi Java düzeyinde değiştirirseniz (örneğin setter'larından birini çağırarak) ve metodunuza **@Transactional** anotasyonunu uygularsanız, açıkça kaydetmenin gerekli olmadığını not etmek önemlidir. Kalıcılığı sizin için transaction'ınız halleder. Bu, JPA'nın temel bir ilkesidir: transactional bir operasyon içinde entity'nize yapılan her değişiklik otomatik olarak kalıcı hale getirilir.

Ancak JPA dışında kalıcılık teknolojileri tercih ederseniz, düzgün kalıcılığı sağlamak için kodunuza kaydetme ifadeleri eklemeyi unutmayın.

### Transaction'da İstisnaları Bastırmak

İş mantığınızda iç içe transaction'ların olduğu bir senaryo düşünün. Farklı bir servisten, istisna fırlatabilecek başka bir metodu çağırıyorsunuz. Mevcut servisinizin metodunu özellikle o istisna için geri alma (rollback) yapacak şekilde yapılandırır ve dıştaki servisin metodunun çağrısını mevcut servis metodu içinde bir try-catch bloğuyla sararsanız, bu, mevcut servisin metodunda bir geri almayı tetiklemez. Bu yaklaşımda dikkatli olun ve mümkün olduğunda try-catch bloklarının kullanımını en aza indirmeye çalışın.

## Sonuç

Epey şeyi ele aldık ve umarım Spring'in transaction yönetimi artık daha net.

Unutmayın, internette başka pek çok kaynak var. Onları da incelemekten çekinmeyin.

Her zamanki gibi, okuduğunuz için teşekkürler!
