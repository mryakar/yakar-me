---
title: "Durmayı Reddeden Program"
description: "Görünürlük, yeniden sıralama, happens-before ve volatile'ın gerçek maliyeti."
short: "Durmayı Reddeden Program"
mediumUrl: https://medium.com/@mr-yakar/the-program-that-refused-to-stop-d517a8fd10ab
---

## TL;DR

- Bir thread'in yazdığı `volatile` olmayan bir alan, başka bir thread'e **asla** görünür olmayabilir. Bu bir gecikme değildir. Bunu düzelten hiçbir bekleme süresi yoktur.
- **JIT derleyicisi** bir alan okumasını döngünün dışına taşıyabilir ve `while (!flag) {}` ifadesini `if (!flag) { while (true) {} }` haline getirebilir. Döngü o zaman sonsuza dek döner.
- Derleyici ve CPU yazmalarınızı **yeniden sıralayabilir** de. Başka bir thread 2 numaralı yazmayı 1 numaralı yazmadan önce görebilir. Bu yasaldır.
- **Java Bellek Modeli (Java Memory Model, JMM)** bir spesifikasyondur, donanımın bir tarifi değildir. Neyin *olamayacağını* listeler. Yasaklanmamış her şeye izin verilir.
- **happens-before** önemli olan tek sıralama ilişkisidir. Bir yazma ile bir okuma arasında bir happens-before kenarı yoksa hiçbir şey garanti edilmez.
- Kenarlar kısa bir listeden gelir: program sırası, monitor unlock/lock, `volatile` yazma/okuma, `Thread.start()`, `Thread.join()`, kesme (interruption), varsayılan ilklendirme — artı geçişlilik.
- `volatile` bir kenar oluşturur. Yalnızca işaretli alanı değil, yazan thread'in yazmadan önce yaptığı **her şeyi** yayımlar.
- `volatile` size **atomikliği** değil, **görünürlüğü** verir. `count++` hâlâ üç işlemdir ve eşzamanlılık altında hâlâ bozuktur.

Serin yaz sabahlarında Amo, anne babası daha uyurken gizlice sokağa çıkar ve top oynardı.

Tek bir kural vardı: kahvaltı hazır olduğunda eve gelmek zorundaydı. Amo'nun annesi de sokağın öbür ucuna bağırıp komşuları uyandırmak yerine haberi evin önündeki duvara yazardı.

*Kahvaltı hazır değil.*

Duvar sokağın öbür ucundaydı. Ona bakmak; oyunu durdurmak, koşarak aşağı inmek, okumak ve koşarak geri dönmek demekti.

İlk birkaç sabah yaptığı buydu.

O sabah Amo'nun annesi mutfaktan çıktı, tebeşiri aldı, duvarı sildi ve yeni bir mesaj yazdı:

**KAHVALTI HAZIR!**

Sonra içeri döndü. Sofrayı kurdu. Çayı doldurdu. Sokağın aşağısında bir yerden, bir garaj kapısına çarpan topun düzenli tok sesi geliyordu.

Kimse gelmedi.

Yumurtalar soğudu.

Aynı şey Java'da da olur:

```java
public class Breakfast {

    static boolean breakfastReady = false;

    public static void main(String[] args) throws InterruptedException {
        Thread amo = new Thread(() -> {
            long kicks = 0;
            while (!breakfastReady) {
                kicks++;
            }
            System.out.println("Amo came home after " + kicks + " kicks.");
        });

        amo.start();
        Thread.sleep(1000);

        breakfastReady = true;
        System.out.println("The wall says: BREAKFAST IS READY!");

        amo.join();
        System.out.println("Breakfast is served.");
    }
}
```

```bash
The wall says: BREAKFAST IS READY!
^C
```

Benim makinemde her seferinde takılıyor: beş çalıştırma, beş takılma, elle beş kesme.

Yazma gerçekleşti. Mesaj doğru. Program yanlış.

Neden?

### Kısaca

- Bir thread bir `boolean`'ı `true` yapar. Başka bir thread o `true` olana kadar döngüde döner.
- Yazma açıkça gerçekleşir; kanıtını ekranda yazdırılmış görebilirsiniz.
- Döngü hiç bitmez. Programın elle öldürülmesi gerekir.

## İnandığımız Kullanışlı Yalan

> Bir thread bir alana yazar. Başka bir thread onu okur. İkincisi yazılan değeri görür.
>
> Bunu size kimse öğretmedi. Öğrenmeniz hiç gerekmedi, çünkü sorgulamak aklınıza hiç gelmedi.

Çıktıya tekrar bakın. Yazma gerçekleşti; kanıtı ekranda. Okuyucu yine de eski değeri görüyor. **Varsayım bozulmuş** ve onu bozan program hiçbir akıllıca şey yapmıyor.

Amo tek başına oynamıyordu. Arkadaşı Simo da onunla oynuyordu ve Simo'nun cebinde bir defter vardı.

Defter, oyunun başında bir kez duvardan kopyalanmıştı. Duvar sokağın öbür ucundaydı ve Simo tembel değildi. Haklıydı. Kopyalamasını ona kimse söylemedi. Bunu kendisi akıl etti.

Duvar güncellendi. Defter güncellenmedi.

Birinci kötü karakter: **bayat kopya**.

![Duvar güncellendi. Defter güncellenmedi. Döngü dönmeye devam ediyor.](./stale-read.gif)

İkinci bir kötü karakter var ve baştan beri hikâyenin içindeydi.

Anne HAZIR yazdı, sonra sofrayı kurdu, sonra çayı doldurdu. Amo bu anların arasında eve gelseydi boş bir sofra ve boş bir bardak bulurdu. Mesaj doğruydu ama gerçek değildi.

**Yazdığınız sıra, çalışan sıra hakkında bir söz değildir.**

İki kötü karakter de bir kusur değildir. İkisi de **optimizasyondur** ve ikisi de genellikle doğrudur. Simo'nun defteri onu sokağın aşağısına yüz kez gidip gelmekten kurtardı ve size bir öğleden sonralık hata ayıklamaya mal olacak yeniden sıralama, dizüstü bilgisayarınızdaki diğer her programı kullanılabilecek kadar hızlı yapan mekanizmanın ta kendisidir.

> **Duvar hakkında bir söz.**
>
> Defter, birinci kötü karakterin dürüst bir resmidir. Dünyada bir şey vardır, bir kopya tutar ve kopya eskir. Onu gösterebilirsiniz.
>
> İkinci kötü karakterin böyle bir karşılığı yoktur. Sokaktaki hiçbir şey annenin sabahını yeniden düzenlemez. Sofrayı kurmadan önce yazdıysa, bu onun kararıydı; kararlar da programcıya aittir. Gerçek yeniden sıralamaya, kodu yazan hiç kimse karar vermez. Koda olmasına **izin verilir**.
>
> Duvarın yetmediği yer burasıdır. Bir defter çizebilirsiniz. Bir izni çizemezsiniz.

Bunu **yavaşlık** başlığı altına koymak cazip gelir. Bir kopya bayatlar, yeni değerin gelmesi biraz zaman alır, döngü birkaç bin kez fazladan döner. Can sıkıcı, ama sınırlı.

Olana tekrar bakın. Amo eve geç gelmedi. Eve gelmedi. Yumurtalar soğudu ve soğuk kaldı; siz öldürdüğünüzde program hâlâ çalışıyordu.

Sizi daha çok rahatsız etmesi gereken daha küçük bir şey var. Döngünün içine bir yazdırma ifadesi eklemek sonucu değiştirdi. Yavaşlık böyle davranmaz. Yavaşlık odada başka neyin olduğunu umursamaz.

O halde apaçık soruyu sorun: ne kadar beklemeniz gerekirdi? Bir sayı yok. Büyük bir sayı değil; hiç yok. Ve eksik sayı bu yazıdaki bir boşluk değil.

### Kısaca

- İki ayrı sorun bir yazmayı başka bir thread'den gizleyebilir: **bayat kopya** ve **yeniden sıralama**.
- İkisi de JVM'de bir hata değildir. İkisi de neredeyse her zaman doğru olan optimizasyonlardır.
- Bu yavaşlık değildir. Yavaş, geç demektir. Bu, asla demektir.

## Görünürlük: Görmek Garanti Değildir

Apaçık açıklama, değerin geç geldiğidir.

Makul bir teori ve adil bir sınamayı hak ediyor. Bilgisayar biliminin her yerinde önbellekler bayatlar ve bayat şeyler tazelenir. DNS çözümleyiciniz yetişir. CDN'iniz yetişir. Tarayıcınız, yeterince beklerseniz ya da iki kez yenile'ye basarsanız yetişir. *Önbellek* sözcüğü içinde bir söz taşır: şimdilik yanlış, eninde sonunda doğru. Birkaç milyon boşa giden yineleme modern bir işlemci için hiçbir şeydir. Amo fark etmekte yavaş. Amo fark edecek.

İki deney aksini söylüyor.

Birincisini belki zaten kazara çalıştırmışsınızdır. Döngünün içine, Amo'nun topa vurduğu yerin yanına bir `println` koyun ve program durur; benim makinemde yaklaşık on üç milyon vuruştan sonra. Beklemeyle ilgili hiçbir şey değişmedi. Değişen şu: **odada artık başka bir şey var**. Yavaşlık odada başka neyin olduğunu umursamaz.

İkinci deneye itiraz etmek daha zordur, çünkü koda hiç dokunmaz.

```bash
$ java Breakfast.java
The wall says: BREAKFAST IS READY!
^C
```

```bash
$ java -Xint Breakfast.java
The wall says: BREAKFAST IS READY!
Amo came home after 105349152 kicks.
Breakfast is served.
```

`-Xint`, JVM'e yorumlayıcı modunda çalışmasını ve optimizasyonu atlamasını söyler.

> **Ortam**
>
> - Intel Core i7–4700HQ (4 çekirdek / 8 thread, x86–64)
>
> - 16 GB DDR3
>
> - Ubuntu 26.04
>
> - Amazon Corretto 21.0.11 (OpenJDK 21, HotSpot, karma mod)

Aynı dosya. Aynı makine. Tek bir bayrak. İkinci çalıştırma yüz milyon vuruştan sonra eve geliyor; birinci çalıştırmanın ihtiyaç duyduğundan **çok daha fazla bekleme**. Daha uzun bekledi ve başardı. Birincisi sonsuza dek bekledi ve başarısız oldu.

Demek ki değişen, kimin ne kadar beklediği değil. Değişen, **makinenin kodla ne yapmasına izin verildiği**.

Bunun üzerinde biraz durmaya değer, çünkü şimdi içgüdü bir çözüme uzanmaktır. Daha uzun bekle. Döngüye bir `Thread.sleep` koy. `Thread.yield` çağır. Döngüye daha fazla iş ver ki daha yavaş çalışsın.

Bunların bazıları işe yarıyor gibi görünecek.

Başınıza gelebilecek en kötü sonuç budur. Hiçbir şey vaat etmeden arızayı gizleyen bir değişiklik programı düzeltmemiştir. Bir şeylerin yanlış olduğuna dair tek kanıtınızı ortadan kaldırmıştır. Hata hayatta kalır, belirti gider ve hak etmediğiniz bir güvenle ürünü gönderirsiniz. Her **Heisenbug**'ın biçimi budur: izlenmeye tepki verir ve ona yanlış biçimde bakmak onu yok eder.

Soruyu doğrudan sorun. Ne kadar beklemeniz gerekirdi?

Bir cevap yok. Büyük bir sayı değil, öngörülemez bir sayı değil; **bir sayı yok**, çünkü eksik olan bileşen zaman değil. Daha uzun beklemek sizi oraya götüremez; tıpkı takvim durmuşsa beklemenin pazartesiyi salıya çeviremeyeceği gibi.

Bu da sorunun yanlış olduğu anlamına gelir. *Ne kadar* diye sormak, hiç orada olmamış bir şeyin boyutunu sormaktır.

Doğru soru, değeri **hiç** görünür kılacak şeyin ne olduğudur; daha erken değil, hiç. Birinin, bir yazmanın bir okuyucuya görünür olacağına söz vermesi gerekir. Yazdığımız programdaki hiçbir şey böyle bir söz içermiyor.

O halde: kim neye, kime söz veriyor?

### Kısaca

- Döngünün içine bir `println` eklemek programı durdurur. Zamanlama böyle işlemez.
- `-Xint` ile çalıştırmak, **hiç kod değişikliği olmadan**, programı durdurur.
- `-Xint` çalıştırması bozuk çalıştırmadan sekiz kat uzun bekledi ve yine de bitti. Demek ki sorun hiçbir zaman bekleme değildi.
- Bunu düzelten hiçbir süre yoktur. Garanti geç değil, eksik.

## Yeniden Sıralama: Yazdığınız Sıra, Çalıştığı Sıra Değildir

“Değer neden hiç görünür olmuyor?” sorusu çözüldü. Yeni soru: değer görünür olduğunda bile hangi sırayla gelir?

```java
// mother
table = "set";
breakfastReady = true;
```

```java
// Amo
if (breakfastReady) {
    eat(table);      // table may still be null
}
```

Amo'nun akıl yürütmesi sağlam. Duvarda HAZIR yazıyor, demek ki annesi yazdı; sofra kurulduğunda yazıyor; dolayısıyla sofra kurulu. Her adım bir öncekinden çıkıyor. İçeri giriyor ve boş bir sofra buluyor.

Bu zincirde yalnızca bir halka kırık ve şüpheleneceğiniz halka o değil. Bayrağı doğru okudu. Annesi sofrayı gerçekten önce kurdu. Onun sırası baştan sona doğruydu.

Kırık halka, kimsenin yazıya dökmediği halka: **onun çalıştığı sıranın, Amo'nun göreceği sıra olduğu.**

Tek bir thread'in içinde o sıra gerçektir. `table = "set"` gerçekten `breakfastReady = true`'dan önce gerçekleşir ve o thread'deki her kod bunu böyle görür. Garanti su geçirmez ve **tam olarak bir gözlemciyi** kapsar.

Amo farklı bir gözlemci. Ona hiçbir söz verilmedi.

Dolayısıyla `breakfastReady` true iken `table`'ın null olması hiçbir kuralı çiğnemez. O kod parçasındaki yorum sizi yük altında nadir bir yarış konusunda uyarmıyor. Programın ne yapmasına izin verildiğini anlatıyor. Düşük olasılıklı değil, zamanlamaya bağlı değil: **yasal**.

![İki yazma da gerçekleşiyor. Yalnızca varış sırası farklı ve programdaki hiçbir şey bunu yasaklamadı.](./reordering.gif)

Derleyici de CPU da talimatlarınızı yeniden sıralamakta serbesttir. Tek kısıt: **tek thread'li bir gözlemci** bunu fark edememelidir.

Yazdığınızı üç katman yeniden sıralayabilir: **derleyici ve JIT**, **CPU**'nun kendisi (sıra dışı yürütme, store buffer'lar) ve onun altındaki **bellek sistemi**. Çoğu geliştirici suçlunun CPU olduğunu varsayar. Daha sık suçlu derleyicidir; JIT de zaten çalışmakta olan kodu yeniden yazmayı sürdürür.

Buna inanmak zorunda değilsiniz. İlk programı bir bayrak ekleyerek yeniden çalıştırın:

```bash
java -XX:+PrintCompilation Breakfast.java 2>&1 | grep Breakfast
```

```bash
620 1385 %     3       me.yakar.Breakfast::lambda$main$0 @ 2 (28 bytes)
621 1387 %     4       me.yakar.Breakfast::lambda$main$0 @ 2 (28 bytes)
```

`%` **yığın üzerinde değiştirme** (on-stack replacement) anlamına gelir: döngü zaten çalışırken kodu altından değiştirildi. `3` ve `4` derleyici katmanlarıdır: önce C1, sonra C2; her biri bir öncekinden daha agresif optimize eder.

Şimdi zaman damgalarını programla karşılaştırın. Ana thread bayrağı ayarlamadan önce bir saniye uyur. İki yeniden derleme de yaklaşık 620 ms'de gerçekleşti; Amo zaten dönerken ve **yazma daha hiç gerçekleşmeden önce**. Anne tebeşiri eline aldığında döngü zaten iki kez yeniden yazılmıştı ve o anda çalışan sürüm, JVM'in üretebildiği en optimize sürümdü.

Sonunda çalışan kod sizin yazdığınız kod değil ve program başladığında seçilmiş bile değildi.

x86 size **güçlü sıralama** (strong ordering) verir. Store'lar verildikleri sırayla görünür olur, dolayısıyla birkaç yeniden sıralama kategorisi orada hiç ortaya çıkmaz; ama hepsi değil. **ARM** ve **POWER** çok daha azını vaat eder ve telefonunuz onlarla çalışır, giderek sunucularınız da.

Bu yazıdaki her deney x86–64 üzerinde çalıştı. Dolayısıyla burada size gösteremediğim yeniden sıralamalar var: nadir oldukları için değil, bu donanım onları bastırdığı için. Başka yerlerde bastırmaz. Donanım da üç katmandan yalnızca biri; üstündeki derleyici x86'da da yeniden sıralamakta serbesttir, ilk programın tam bu makinede zaten gösterdiği gibi.

“Benim makinemde çalışıyor” burada zayıf bir kanıt değil. **Kanıt değil.**

O halde iki kötü karakter. Biri size değeri hiç göstermez. Diğeri onu sizin yazmadığınız bir sırayla gösterir.

İkisi de arızalı değil. JIT sözünü tuttu: tek thread'li hiçbir gözlemci farkı anlayamazdı. CPU sözünü tuttu. x86 sözünü tuttu. Her katman tam olarak belirtildiği gibi davrandı.

**İkinci thread'inize** hiç kimse söz vermedi.

### Kısaca

- Derleyici, JIT, CPU ve bellek sistemi talimatlarınızı yeniden sıralayabilir.
- Uymak zorunda oldukları tek kural: **tek thread'li** bir gözlemci fark etmemelidir. Diğer thread'iniz o gözlemci değildir.
- `-XX:+PrintCompilation`, döngünün zaten çalışırken iki kez yeniden derlendiğini gösterir.
- x86 bazı yeniden sıralamaları gizler. ARM ve POWER gizlemez. Aynı kod farklı donanımda farklı davranabilir.

## Java Bellek Modeli (JMM): Bir Makine Değil, Bir Sözleşme

“İkinci thread'inize hiç kimse söz vermedi.” O halde kim veriyor?

**JMM** veriyor. Bir makine değil. Bir thread'in başka bir thread'in işinden neyi, hangi sırayla görmesinin garanti edildiğini tanımlayan bir model.

JMM'yi gözünüzde canlandırdığınızda muhtemelen donanımı canlandırırsınız: önbellekler, çekirdekler, store buffer'lar. Bu yine defter ve bu konuda uyarılmıştınız. Bir defteri çizebilirsiniz, bir izni çizemezsiniz. Resim sezgi için yararlı, tanım olarak yanlıştır.

İşte kanıt. Aynı programdan aynı makinede başka nasıl iki farklı sonuç alırsınız? `-Xint`'i hatırlayın. Tek bayrak, kod değişikliği yok, donanım değişikliği yok ve sonsuza dek dönen döngü artık sona eriyor. Değişen, JVM'in ne yapmasına **izin verildiği**. Bir kural donanımdan okunamıyorsa, donanım onun kaynağı değildir.

O halde taraflar kim?

Bir tarafta siz. Diğer tarafta, üzerinde çalışacağı her mimarideki her JVM uygulaması: x86'da HotSpot, POWER'da OpenJ9, henüz tasarlanmamış donanımda ne çalışacaksa. JMM tek bir makinenin nasıl davrandığını anlatmaz. Hepsinin uyması gereken **asgariyi** tanımlar.

Ve burada sözleşme beklemeyeceğiniz yönde işler. Size ne *olacağını* söylemez. Size ne *olamayacağını* söyler. Bir sözler listesi değil, bir **yasaklar listesidir**.

Bu da yasaklanmamış her şeyin yasal olduğu anlamına gelir. Gözlemlediğiniz çalıştırma, pek çok yasal yürütmeden biridir. Yarın farklı birini alabilirsiniz ve ikisi de doğrudur. **Testin bir eşzamanlılık hatasının yokluğunu kanıtlayamamasının** nedeni budur: yeşil bir test takımı size hangi yürütmenin denk geldiğini söyler, hangilerinin mümkün olduğunu değil.

Bütün bunlardan size hiçbir şey verilmediği sonucunu çıkarabilirsiniz. Tersi doğrudur. Sözleşme, bir MacBook'ta kod yazıp onu ikisini de düşünmeden bir ARM sunucusunda çalıştırmanızı sağlayan şeyin ta kendisidir. O olmasaydı, “bir kez yaz, her yerde çalıştır” tek bir thread için geçerli olmaya devam eder ve ikinci bir thread başlattığınız an sessizce bozulurdu; siz de store buffer'lar için mimari başına, elle ayar yapıyor olurdunuz.

Demek ki: bir sözleşme var. Taraflar belli. Bir soru kalıyor.

Maddeleri hangi dilde yazılmış?

### Kısaca

- JMM bir **spesifikasyondur**, belirli bir CPU'nun tarifi değildir.
- Henüz var olmayan donanım dahil, her mimarideki her JVM'i bağlar.
- Neyin **olamayacağını** listeleyerek çalışır. Geri kalan her şeye izin verilir.
- Geçen bir test size yasal bir yürütmeyi gösterir. Diğerlerini göstermez.

## Happens-Before: Sözleşmenin Küçük Harfli Maddeleri

Gündelik konuşmada “bir şey diğerinden önce olur” zamanla ilgili bir iddiadır: saatler, dakikalar, bir saat okumasının diğerinden küçük olması. Burada bu içgüdü bir tuzaktır. Bu sözleşmenin maddeleri **zamanla** değil, **sırayla** ilgilidir.

A, B'den **önce gerçekleştiğinde** (happens-before), A'nın yaptığı her şey B'ye görünürdür ve B ondan sonra sıralanır. İfadenin bütün içeriği budur.

Tire önemlidir. **happens before ≠ happens-before.**

Annenin sahnesi bunu size bedavaya verir. `table = "set"`, tutabileceğiniz her saate göre, kelimenin tam anlamıyla `breakfastReady = true`'dan önce gerçekleşti. Ama Amo'ya ulaşan bir happens-before kenarı yoktu, dolayısıyla ona hiçbir şey garanti edilmedi. Zaman geçti. Garanti geçmedi.

Sözleşmenin kısa bir madde listesi var. Her biri bir happens-before kenarı oluşturur; başka hiçbir şey oluşturmaz.

**Program sırası.** Tek bir thread içinde her eylem, kaynakta kendisinden sonra gelen her eylemden önce gerçekleşir (happens-before). Su geçirmez ve tek bir thread ile sınırlı.

**Monitor kilidi.** Bir monitor üzerindeki bir unlock, aynı monitor üzerindeki sonraki her lock'tan önce gerçekleşir.

**Volatile.** Bir `volatile` alana yazma, aynı alanın sonraki her okumasından önce gerçekleşir.

**Thread başlatma.** Bir thread üzerinde `start()` çağrısı, başlatılan thread'deki her eylemden önce gerçekleşir.

**Thread sonlanması.** Bir thread'deki bütün eylemler, başka bir thread'in onun üzerindeki `join()`'den dönmesinden önce gerçekleşir.

**Kesme.** Bir thread'in başka birini kesmesi, kesilen thread'in bunu fark etmesinden önce gerçekleşir.

**İlklendirme.** Bir alanın varsayılan ilklendirmesi (`0`, `false`, `null`), programdaki diğer her eylemden önce gerçekleşir.

Ve geri kalanını değerli kılan kural:

**Geçişlilik.** A, B'den önce gerçekleşiyorsa ve B, C'den önce gerçekleşiyorsa, A da C'den önce gerçekleşir.

Bu maddelerin ikisi belirli bir anahtar sözcükten ve belirli bir metot çiftinden söz eder. Listedeki geri kalan her şey ya otomatiktir ya da zaten düşünmeden yaptığınız bir şeydir.

Bu da bizi, en başından beri çalıştırdığınız programla ilgili rahatsız edici bir gözleme getirir. Program zaten **iki happens-before kenarı** içeriyor. Onları fark etmeden yazdınız.

`amo.start()` bunlardan biri: ana thread'in o çağrıdan önce yaptığı her şeyin Amo'ya görünür olması garanti edilir. `amo.join()` diğeri ve ters yönde işliyor: `join()` döndüğünde Amo'nun yaptığı her şeyin ana thread'e görünür olması garanti edilir.

Yazmanın nerede durduğuna bakın:

```java
amo.start();             // edge #1
Thread.sleep(1000);
breakfastReady = true;   // no edge
amo.join();              // edge #2
```

![start() ve join() birer kenar oluşturuyor. Ortadaki yazma ikisine de bağlı değil.](./happens-before.gif)

Yazma `start()`'tan **sonra** gerçekleşiyor, dolayısıyla başlatma kuralı onu kapsamıyor. `join()` dönmeden **önce** gerçekleşiyor, ama Amo `join()`'den sonra hiçbir şey okumuyor; onun içinde dönüyor. Bütün programdaki önemli tek yazma, listedeki hiçbir kenara bağlı olmayan tek eylem.

Hata bu. Bir önbellek değil, bir derleyici değil, bir mimari değil. **Eksik bir madde.**

Daha önce yeniden sıralamaya bir izin demiştik. Happens-before ise tasmadır.

Bir kenarın olduğu yerde yeniden sıralama ortadan kalkmaz; makine alttaki talimatları yine karıştırabilir. Yapamayacağı şey, bu karıştırmanın kenar boyunca **görünür hale gelmesine** izin vermektir. Bu, öncekiyle aynı biçimdir: sözleşme donanımın ne yaptığını anlatmaz. Neyi gözlemlemenize izin verildiğini anlatır.

Artık maddelerin hangi dilde yazıldığını biliyorsunuz ve programınızda birinin eksik olduğunu biliyorsunuz.

Hâlâ nasıl yazılacağını bilmiyorsunuz.

### Kısaca

- **happens-before** saatle değil, sıralama ve görünürlükle ilgilidir.
- Bir şeyin zamanda daha önce olması thread'ler arasında hiçbir şey garanti etmez.
- Kenarların tam listesi kısadır: program sırası, monitor unlock/lock, `volatile` yazma/okuma, `start()`, `join()`, kesme, varsayılan ilklendirme — artı geçişlilik.
- Programımızda zaten iki kenar vardı (`start()` ve `join()`). Önemli olan tek yazmanın hiç kenarı yoktu.

## volatile: Her Zaman Eşitlenen Alan

Listeye geri dönün. Bir madde tam olarak bu programda eksik olanı yapıyor: *volatile bir alana yazma, aynı alanın sonraki her okumasından önce gerçekleşir.*

O halde tek bir anahtar sözcük ekliyoruz:

```java
static volatile boolean breakfastReady = false;
```

Dosyada başka hiçbir şey değişmiyor. Tekrar çalıştırın:

```bash
The wall says: BREAKFAST IS READY!
Amo came home after 1700811096 kicks.
Breakfast is served.
```

![Önbelleğe alınmış kopya yok. Her tur gerçek bir okuma, dolayısıyla yeni değer yazıldığı anda görülüyor.](./volatile-fixed.gif)

Amo duvara baktı; gerçek duvara, sokağın öbür ucundakine, ilk sabahlarda yaptığı gibi. Okudu ve koştu.

Yumurtalar hâlâ sıcaktı.

Bunun yarısı apaçık. Okuma artık döngünün dışına taşınamaz. Her tur alana geri döner ve yeniden sorar.

Açıklamaların çoğu burada durur. Bu, küçük olan yarısıdır.

İşte diğer yarısı. Kenar yalnızca `breakfastReady`'yi taşımaz. **Yazan thread'in ondan önce yaptığı her şeyi taşır.**

Bu da annenin sahnesinin artık işe yaradığı anlamına gelir. `table = "set"` volatile yazmadan önce geldi, dolayısıyla kenarın güvenli tarafında duruyor. Amo null bir sofra değil, kurulu bir sofra görüyor.

Ve `table` volatile değil. Kimse ona dokunmadı.

Bunların hiçbiri bedava değil. Ama maliyet, çoğu insanın koyduğu yerde değil.

Olağan hikâye şöyle: volatile bir alan önbelleği atlar ve her okumada, her yazmada RAM'e kadar gider. Derli toplu, akılda kalıcı ve yanlış. Doğru olsaydı volatile kullanılamaz olurdu; ana bellek L1 önbellekten kabaca iki yüz kat yavaştır. x86'da volatile bir okuma, sıradan bir okumayla aşağı yukarı aynı maliyettedir.

İşte gerçekte olan.

**Sorun hiçbir zaman önbellekler değildi.** Modern işlemciler onları, istenmeden, donanımda birbiriyle eşitlenmiş tutar. Bir çekirdek bir değer yazar; diğer çekirdeklerin önbelleklerine haber verilir. Bu mekanizma siz `volatile` yazsanız da yazmasanız da çalışır.

Eşitlenmiş *tutulmayan* şey, bir **yazmaçta** (register) duran bir kopyadır. Yazmaçlar CPU'nun özel karalama alanıdır ve hiçbir şey onları başka hiçbir şeyle eşgüdümlemez. Simo'nun defterinin gerçekte yaşadığı yer orasıdır. Önbellekte değil, bir yazmaçta. Derleyici onu oraya koydu, çünkü aynı alanı tekrar tekrar okumak savurgan görünüyordu ve hiçbir şey bunu yasaklamıyordu.

Dolayısıyla maliyetin ilk yarısını **derleyici** öder. Hamlelerini kaybeder. Alanı bir yazmaca park edemez, okumayı döngünün dışına taşıyamaz, az önce okuduğu bir değeri yeniden kullanamaz. Her tur gerçek bir okumadır.

İkinci yarısı **yazmada** ödenir. x86'da volatile bir yazmanın ardından, işlemciyi bekleyen yazmalarını dışarı itmeye zorlayan bir bariyer gelir; ondan sonraki hiçbir şey bu olmadan ilerleyemez. Pahalı olan bu beklemedir. Okumalar neredeyse bedavadır; faturanın geldiği yer yazmalardır.

Defter gitti. Amo her seferinde duvara koşuyor; anne de artık yazı gerçekten orada olana kadar duvarın başında bekliyor.

Demek ki program düzeldi, hikâyenin bir sonu var ve başladığınız sorunu çözen bir anahtar sözcüğünüz var.

Dikkatli olmak için iyi bir an.

### Kısaca

- `volatile` bir happens-before kenarı oluşturur; bu da tam olarak eksik olan maddedir.
- Kenar, yazan thread'in yazmadan önce yaptığı **her şeyi** yayımlar; yalnızca işaretli alanı değil.
- `volatile` veriyi RAM'e itmez. Önbellekler zaten donanım tarafından eşitlenmiş tutulur. Durdurduğu şey, derleyicinin bir kopyayı bir **yazmaçta** tutmasıdır.
- Okumalar ucuzdur. Maliyet, ardından gelen bellek bariyeri yüzünden **yazmadadır**.

## volatile'ın Size VERMEDİKLERİ

Tek bir anahtar sözcük, tek bir satır, sorun çözüldü. Bu iyi bir his ve korumaya değer; yaklaşık bir sayfa boyunca.

Aynı anahtar sözcüğü bir adım öteye götürün ve dağılışını izleyin.

İki thread, bir sayaç, her biri bir milyon artırma. Alan volatile, dolayısıyla görünürlük halledilmiş.

```java
public class Counter {
    static volatile int count = 0;

    public static void main(String[] args) throws InterruptedException {
        Runnable job = () -> {
            for (int i = 0; i < 1_000_000; i++) {
                count++;
            }
        };

        Thread a = new Thread(job);
        Thread b = new Thread(job);

        a.start(); b.start();
        a.join();  b.join();

        System.out.println("expected: 2000000");
        System.out.println("actual:   " + count);
    }
}
```

```makefile
expected: 2000000
actual:   1422924
```

Tekrar çalıştırın, farklı bir sayı alırsınız. Birkaç kez daha çalıştırın, doğrusunu alabilirsiniz; bu da yanlışını almaktan daha kötüdür. Yeniden sıralama bölümünün vardığı noktanın aynısı, bu kez farklı bir yönden yeniden geliyor.

Yaklaşık altı yüz bin artırma eksik. Nereye gittiler?

`count++` tek bir talimat gibi görünür. **Üç talimattır.**

Değeri oku. Bir ekle. Geri yaz.

Şimdi o üç adımın içine iki thread koyun. İkisi de 41 okur. İkisi de bir ekler. İkisi de 42 yazar. İki artırma girdi, bir tane çıktı.

![Hiçbir şey bayat değildi. İki thread de güncel bir değer okudu; yalnızca aynısını okudular.](./lost-update.gif)

Orada neyin yanlış *gitmediğine* dikkatle bakın. Hiçbir şey bayat değildi. İki thread de tamamen güncel bir değer okudu; volatile maddesi işini tam yazıldığı gibi yaptı. Yalnızca **aynı** değeri okudular.

Bunlar iki farklı garantidir ve adlarını yüksek sesle söylemeye değer.

**Görünürlük**, en son değeri görüp görmediğinizle ilgilidir. **Atomiklik**, bir işlemin yarısında kesilip kesilemeyeceğiyle ilgilidir.

`volatile` size birincisini verir. İkincisini hiçbir zaman vermedi. Bu yazıdaki her şey şimdiye kadar birincisi hakkındaydı.

Bu dilde bir boşluk değildir ve `volatile`'da bir kusur değildir. Maddeye geri dönün: *volatile bir alana yazma, aynı alanın sonraki her okumasından önce gerçekleşir.* Tekrar okuyun ve neyden söz etmediğine dikkat edin. İki thread'in sırayla çalışması hakkında hiçbir şey söylemiyor. Bir işlemin baştan sona araya girilmeden çalışması hakkında hiçbir şey.

Sözleşmeden, içinde hiç olmamış bir madde istediniz. Sözleşme de baştan beri yaptığını yaptı: sözünü tuttu, tam olarak ve ötesine geçmeden.

Diğer garantinin araçları var ve bu onlardan biri değil. Bunun gibi bir sayaç için `AtomicInteger`. Birkaç alanın birlikte değişmesi gerektiğinde `synchronized` ya da bir `Lock`. Sayaç sıcak ve yoğun çekişme altındayken `LongAdder`. Her biri kendi yazısını hak ediyor. Hiçbiri `volatile` değil.

O halde anahtar sözcüğü tutun ve ne ise onun için tutun: dar bir iş için doğru araç. Bir thread bir değer yazar, diğer thread'ler onu okur ve kimsenin yazması az önce okuduğuna bağlı değildir. Bir durum bayrağı. Bir kapatma sinyali. Bir kez yayımlanıp sonra kendi haline bırakılan bir referans.

Bir yazma az önce okuduğunuz değere bağlı olduğu anda `volatile` artık yetmez ve farklı bir maddeye ihtiyacınız olur.

### Kısaca

- `volatile` **görünürlük** verir. **Atomiklik** vermez.
- `count++` okuma, ekleme, yazmadır. İki thread bu üç adımın içine girip bir güncellemeyi kaybedebilir.
- O arızada hiçbir şey bayat değildi. İki thread de güncel bir değer okudu; aynısını.
- Bir yazma az önce okunan değere bağlıysa `AtomicInteger`, `synchronized`, bir `Lock` ya da `LongAdder` kullanın.

## Sözleşmenin Kopya Kâğıdı

Durmayacak bir programla başladınız. Artık nedenini biliyorsunuz ve cevabın programla neredeyse hiç ilgisi olmadığı ortaya çıktı.

İşte yanınıza almanız gerekenler.

**1. Görünürlük bir zaman meselesi değildir.**

Gelmesi garanti edilmemiş bir değer geç gelmez. Hiç gelmeyebilir. Eksik bir garantiyi düzelten hiçbir süre yoktur; bu yüzden bir sleep eklemek, döngüyü yavaşlatmak ya da daha uzun beklemek çözüm değildir. En iyi ihtimalle arızayı gizler ve size kanıtı kaybettirirler.

**2. Yazdığınız sıra, çalışan sıra değildir.**

Derleyici, JIT ve işlemci talimatlarınızı yeniden düzenleyebilir. Tek kısıt, tek thread'li bir gözlemcinin bunu fark edememesidir. İkinci thread'iniz o gözlemci değildir.

**3. JMM bir makine değil, bir sözleşmedir.**

Önbellekleri, çekirdekleri ya da store buffer'ları anlatmaz. Her mimarideki her JVM'in uyması gereken asgariyi tanımlar. Neyin olamayacağını listeleyerek çalışır; bu da yasaklanmamış her şeyin yasal olduğu anlamına gelir. Gözlemlediğiniz çalıştırma da pek çok yasal yürütmeden biriydi. Test size hangisinin denk geldiğini gösterir, hangilerinin mümkün olduğunu değil.

**4. Happens-before tek geçerli paradır.**

Bir kenar görünür kılmadıkça thread'ler arasında hiçbir şey görünür değildir. Maddeler kısadır ve gizli fazladan bir madde yoktur: program sırası, monitor unlock'tan lock'a, volatile yazmadan okumaya, `start()`'tan bir thread'in içine, bir thread'den `join()`'e, kesmeden fark edilmeye, varsayılan ilklendirme. Ve onların yararlı bir şeye zincirlenmesini sağlayan geçişlilik.

**5.** `volatile` **atomiklik değil, görünürlük satın alır.**

Bir kenar oluşturur ve kenar, yazan thread'in ondan önce yaptığı her şeyi taşır; yalnızca işaretlediğiniz alanı değil. Yapmadığı şey, bir işlemi bölünmez kılmaktır. `count++` hâlâ üç adımdır ve iki thread hâlâ onların içine sığar.

**Sorulması gereken soru**

Bir dahaki sefere birden fazla thread'in dokunduğu bir alan gördüğünüzde, thread güvenli görünüp görünmediğini sormayın. Bunun yerine iki şey sorun:

**Onu kim yazıyor ve okuyucunun onu göreceğini hangi madde garanti ediyor?**

Maddeyi adlandıramıyorsanız, yoktur. Küçük bir garanti değil, olası bir garanti değil, dizüstü bilgisayarınızda çoğu zaman geçerli olan bir garanti değil. Yoktur.

Yumurtalar sessizce soğur ve program çalışmaya devam eder.

## Kaynaklar

**Spesifikasyon**

- *The Java® Language Specification, Chapter 17: Threads and Locks* (§17.4.5).
 [https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html](https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html)
- *JSR-133: Java Memory Model and Thread Specification* (2004)
 [https://www.cs.umd.edu/~pugh/java/memoryModel/jsr133.pdf](https://www.cs.umd.edu/~pugh/java/memoryModel/jsr133.pdf)
- *JSR-133 (Java Memory Model) FAQ* 
 [https://www.cs.umd.edu/~pugh/java/memoryModel/jsr-133-faq.html](https://www.cs.umd.edu/~pugh/java/memoryModel/jsr-133-faq.html)

**Uygulama ve donanım**

- Doug Lea, *The JSR-133 Cookbook for Compiler Writers*
 [https://gee.cs.oswego.edu/dl/jmm/cookbook.html](https://gee.cs.oswego.edu/dl/jmm/cookbook.html)
- Rajiv Prabhakar, *Myths Programmers Believe about CPU Caches*
 [https://software.rajivprab.com/2018/04/29/myths-programmers-believe-about-cpu-caches/](https://software.rajivprab.com/2018/04/29/myths-programmers-believe-about-cpu-caches/)
