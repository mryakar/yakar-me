---
title: "Her Alan Atomik. Bakiye Yine de Eksi."
description: "Hiçbir yerde kilit yok, hesap yine de eksiye düşüyor. Compare-and-set ne yapar, gerçekte neyi karşılaştırır ve kodunuzu ne zaman iki kez çalıştırır."
short: "Her Alan Atomik"
mediumUrl: https://medium.com/@mr-yakar/every-field-is-atomic-the-balance-is-still-negative-bcd22afc9c3a
---

## TL;DR

- Bakiye bir `AtomicLong`, kilit yok, 8 thread 100'den 100 çekiyor: bakiye 10.000 turun 4.550–5.683'ünde eksiye düştü, -700'e kadar. Her çağrı atomikti. Kontrol ve yazma birlikte değildi.
- Aynı program bir `compareAndSet` döngüsüyle: eksiye düşen tur 0, 5 çalıştırmanın 5'inde.
- Bu döngü, PostgreSQL yazısındaki sürüm sütunuyla aynı fikir, bir katman aşağıda: yalnızca hiçbir şey değişmediyse yaz, yoksa baştan başla.
- x86'da derlenmiş `getAndIncrement`, etrafında döngü olmayan tek bir talimattır. O optimizasyonu kapatın, bir compare-and-set'e dönüşür; thread'ler yarıştığında da bir yeniden deneme döngüsüyle.
- `updateAndGet`, 8 thread'de 8.000.000 güncelleme için fonksiyonunu 31.339.201–39.623.599 kez çalıştırdı. Fonksiyonun yan etkisi olmamalı.
- Kilit yok, bekleme yok demek değil: 8 thread'de her başarıya karşılık 1,11–2,20 deneme başarısız oldu, tek bir artırma 6.694 deneme sürdü ve bir thread dump olağandışı hiçbir şey göstermedi.
- `LongAdder`, sıcak sayaçlarda iş hacmi için bellekten verir. compare-and-set'i yoktur ve `sum()`'ı bir anlık görüntü değildir; bu yüzden bir bakiyeyi asla onunla kontrol etmeyin.
- `compareAndSet` referansları karşılaştırır: varsayılan bir JVM'de 127 eşleşir, 1000 eşleşmez. 100 -> 50 -> 100'ü de göremez. Bir damga (stamp) görebilir.
- Birlikte değişmesi gereken iki alan: iki `AtomicLong`, 10.000 pencerenin 600–797'sinde 10'luk sınırın aşılmasına izin verdi. Tek bir değişmez record: 0.

> ***Bu yazıdaki her çıktının ortamı:*** *Intel Core i7-4700HQ (4 çekirdek / 8 thread, x86-64), 16 GB DDR3-1600, Ubuntu 26.04, Amazon Corretto 25.0.4 (her demo 21.0.11'de de çalıştırıldı, yön aynı). Sayılar sizin makinenizde farklı olacaktır; yön değişmez. Makine kodu bölümü x86-64 ister.*

**Kaynak kod.** Her program [`article-examples`](https://github.com/mryakar/article-examples) deposunda, `cas-atomic-classes/` altında. Her demo bağımlılıksız tek bir Java dosyası; her birinin komutu README'de.

---

## Her Alan Atomik

`synchronized` yazısındaki hesap geri döndü. Orada iki hesaptaki iki kilit deadlock'a girmişti. Burada hiç kilit yok; dolayısıyla deadlock da yok.

Bakiye bir `AtomicLong`. Para çekme işlemi onu `get()` ile okuyor ve `addAndGet()` ile yazıyor:

```java
static boolean withdraw(Account from, long amount) {
    if (from.balance.get() >= amount) {
        from.balance.addAndGet(-amount);
        return true;
    }
    return false;
}
```

Satır satır okuyun, hiçbir şey yanlış görünmüyor. Bakiye üzerindeki her çağrı atomik.

`"A"` hesabı 100 ile başlıyor. Sekiz thread aynı anda ondan 100 çekmeye çalışıyor, dolayısıyla en fazla biri başarılı olmalı. Program bunu 10.000 kez tekrarlıyor ve sıfırın altında biten turları sayıyor. Beş çalıştırma:

```
overdrawn 4567/10000 rounds, lowest -700
overdrawn 5683/10000 rounds, lowest -700
overdrawn 5450/10000 rounds, lowest -700
overdrawn 4615/10000 rounds, lowest -600
overdrawn 4550/10000 rounds, lowest -600
```

JDK 25'te, her çalıştırmada turların yaklaşık yarısında hesap eksiye düştü. -700'lük bir bakiye, sekiz thread'in hepsinin para çektiği anlamına gelir: orada 100 vardı, 800 çıktı.

Bakiye üzerindeki her çağrı atomikti. Peki eksiye düşme nereden geldi?

### Kısaca

- Bakiye bir `AtomicLong`, kilit yok, sekiz thread aynı anda 100'den 100 çekiyor.
- Bakiye üzerindeki her çağrı atomik.
- Bakiye, 5 çalıştırmanın hepsinde, 10.000 turun 4.550–5.683'ünde eksiye düştü.
- En kötü turlarda sekizi de para çekti ve bakiye -700'de kaldı.

---

## Tek Bir Atomik Çağrı Size Ne Kazandırır

İlk Java yazısı güncelleme kaybeden bir sayaçla bitmişti. `count++` bir okuma, bir toplama ve bir yazmadır; iki thread de bu üç adımın içinde aynı anda bulunabilir.

İşte o sayaç iki kez. İki thread, her biri bir milyon artırma; yalnızca sayacın türü değişiyor. Beş çalıştırmadan ikisi:

```
volatile int : 927,485 of 2,000,000
AtomicInteger: 2,000,000 of 2,000,000
volatile int : 1,343,315 of 2,000,000
AtomicInteger: 2,000,000 of 2,000,000
```

`AtomicInteger` hiçbir çalıştırmada hiçbir şey kaybetmedi. `incrementAndGet()`'i okuma, toplama ve yazmayı **tek bir bölünmez adım** olarak yapar. Başka hiçbir thread değeri yarı yolda göremez ya da değiştiremez.

Garantinin tamamı bu, ama bir sınırı var: **tek bir çağrıyı** kapsar. İki atomik çağrıyı yan yana koyun, bir değil iki atomik adım elde edersiniz. Aralarında diğer her thread çalışmakta serbesttir.

`withdraw`'un yaptığı tam olarak bu. `get()` atomik. `addAndGet()` atomik. Aralarında başka thread'ler de 100 okur, kontrolü de geçer ve onlar da yazar. Her kontrol çalıştığı anda doğruydu. Yazması çalıştığında artık doğru değildi.

İki atomik çağrı bir boşluk bırakır. Onu ne kapatır?

### Kısaca

- `AtomicInteger` ilk yazıdaki sayacı düzeltir: her çalıştırmada 2.000.000'da 2.000.000.
- Aynı iş `volatile int` ile 927.485–1.343.315'te kaldı.
- Garanti çağrı başınadır. Art arda iki atomik çağrı tek bir atomik işlem değildir.
- Eksiye düşme, kontrol ile yazma arasında gerçekleşir.

---

## Compare-and-Set: Koşullu Yazma

Çözüm bir kilit değil. Yazma üzerinde bir koşul.

`compareAndSet(expectedValue, newValue)` yalnızca değer hâlâ beklediğiniz değerse yazar ve yazıp yazmadığını size söyler. Belgelerin ifadesiyle, *"geçerli değer `== expectedValue` ise değeri atomik olarak `newValue` yapar."* Kimse beklemez. Kaybeden bir thread `false` alır ve sonra ne yapacağına kendisi karar verir.

Para çekme bir döngüye dönüşür: bakiyeyi oku, kontrol et, yazmayı dene ve önce başkası yazdıysa baştan başla:

```java
static boolean withdrawCas(Account from, long amount) {
    while (true) {
        long current = from.balance.get();
        if (current < amount) return false;
        if (from.balance.compareAndSet(current, current - amount)) {
            return true;
        }
    }
}
```

Birkaç thread yine de 100 okuyup kontrolü geçebilir. Orada 100'ü yalnızca bir `compareAndSet` bulur. Kaybedenler 0 bulur, hiçbir şey yazmaz ve döngüde bir tur daha atar; bu kez kontrol başarısız olur.

![Animasyon: iki thread de 100'lük bakiyeyi okuyor ve ikisi de kontrolü geçiyor. A thread'inin compare-and-set'i başarılı oluyor ve bakiye 0 oluyor. B thread'inin compare-and-set'i başarısız oluyor, çünkü bakiye artık 100 değil. B thread'i yeniden okuyor, 0 görüyor ve hiçbir şey çekmiyor.](./cas-withdraw.gif "Kaybeden thread yazmaz. Yeniden okur ve bu kez kontrol hayır der.")

Aynı program, aynı sekiz thread, aynı 10.000 tur; yalnızca `withdraw`'un gövdesi değişti. Beş çalıştırmanın hepsi aynı satırı yazdırdı:

```
cas             overdrawn 0/10000 rounds, lowest 0
```

PostgreSQL'de açık kilitleme yazısını okuduysanız bunu daha önce gördünüz. O yazının sonunda *"iki sütuna da ait olmayan üçüncü bir seçenek"* vardı:

```sql
UPDATE accounts SET balance = ?, version = version + 1
 WHERE id = ? AND version = ?;
```

ve şu satır: *"Bu, SQL ile yazılmış compare-and-set'tir. Java'da aynı fikir donanımda var; o da bir sonraki yazının konusu."* Bu, o yazı. Sürüm sütunu ile `compareAndSet` tek bir fikri paylaşır: yalnızca okuduğunuzdan beri hiçbir şey değişmediyse yaz, yoksa baştan başla. Biri bir satırı korur, diğeri bir bellek hücresini.

### Kısaca

- `compareAndSet` yalnızca değer hâlâ okuduğunuz değerse yazar. Kimse beklemez.
- Para çekme bir döngüye dönüşür: oku, kontrol et, compare-and-set, başarısız olduysa baştan başla.
- Aynı program, bir döngü eklenmiş: 5 çalıştırmanın hepsinde 10.000 turda eksiye düşen tur 0.
- PostgreSQL yazısındaki sürüm sütunuyla aynı fikir, bir katman aşağıda.

---

## Altında Tek Bir Talimat

Compare-and-set'in kendisi nasıl tek adım olabilir? `synchronized` yazısı *"compare-and-swap ve onun üzerine kurulu atomik sınıflar"* sözü vermişti. Bu bölüm o sınıfların neyin üzerine kurulu olduğuna bakıyor.

x86'da compare-and-set tek bir işlemci talimatıdır, `lock cmpxchg`: karşılaştırma ve yazma, başka hiçbir çekirdeğin bölemeyeceği tek bir adımda. Yine de başarısız olabilir, bu yüzden yukarıdaki gibi bir döngünün içinde durur. Her atomik sınıf bu döngüyü çalıştırır mı? En yaygın metot çalıştırmaz. JIT `getAndIncrement()`'i derlerken farklı bir talimat kullanır, `lock xadd`: toplar ve eski değeri tek adımda döndürür. Karşılaştırılacak bir şey yok, dolayısıyla yeniden denenecek bir şey de yok. O optimizasyonu kapatın, aynı metot `lock cmpxchg`'ye geri döner:

```
getAndIncrement: lock xadd, loop: no
intrinsic off  : lock cmpxchg, loop: no
off, 4 threads : lock cmpxchg, loop: yes
```

Beş çalıştırma, aynı üç satır. Döngü derlenmiş kodda yalnızca thread'ler yarıştığında ortaya çıkıyor. Tek thread'de yarış yoktu ve JIT başarısızlık yolunu bir döngü olarak değil, daha yavaş koda geri dönen nadir bir çıkış olarak derledi. Bu makine kodunun nasıl yazdırılıp okunacağı deponun README'sinde. Sınıfı kullanmak için buna ihtiyacınız yok.

### Kısaca

- Compare-and-set başarısız olabilen tek bir CPU talimatıdır, bu yüzden bir döngünün içinde durur.
- x86'da derlenmiş `getAndIncrement`, etrafında döngü olmayan tek bir talimattır.
- O optimizasyonu kapatın, bir compare-and-set'e dönüşür; thread'ler yarıştığında da bir yeniden deneme döngüsüyle.

---

## Döngü Kodunuzu İki Kez Çalıştırabilir

O döngüyü nadiren elle yazarsınız. `updateAndGet(fn)` onu sizin için yazar: değeri oku, fonksiyonunuzu uygula, sonucu compare-and-set ile yaz, başka bir thread önce davrandıysa baştan başla. Baştan başlamak, fonksiyonunuzu yeniden çağırmak demektir. Belgeler bunu açıkça söyler: *"Fonksiyon yan etkisiz olmalıdır, çünkü thread'ler arasındaki çekişme yüzünden güncelleme denemeleri başarısız olduğunda yeniden uygulanabilir."*

Ne sıklıkla? Bu fonksiyon kendi çağrılarını sayıyor, thread başına bir milyon güncelleme:

```java
value.updateAndGet(v -> {
    calls.incrementAndGet();   // a side effect
    return v + 1;
});
```

```
1 thread : 1,000,000 calls for 1,000,000 updates
8 threads: 39,623,599 calls for 8,000,000 updates
8 threads: 31,339,201 calls for 8,000,000 updates
```

Tek thread'de her güncelleme ilk denemede başarılı oldu: güncelleme başına bir çağrı. Sekiz thread'de, beş çalıştırmanın en yükseği ve en düşüğü bu makinede **her güncelleme için yaklaşık dört ila beş çağrı** gösteriyor. Çağrıları saymak da paylaşılan bir güncelleme daha olduğu için çekişmeyi artırıyor. Son değer her seferinde doğruydu. Yalnızca yan etki katlandı.

Dolayısıyla o fonksiyonun içine yeni değeri hesaplamaktan başka hiçbir şey girmez. Bir log satırı tek bir güncelleme için birkaç kez basılırdı. Bir sayaç fazla sayardı. Başka bir servise yapılan bir çağrı birkaç kez yapılırdı.

MVCC yazısında aynı kural bir katman yukarıda, bir veritabanı transaction'ı için vardı: *"Transaction gövdesi birden fazla kez çalışacaktır."* Burada gövde sizin lambda'nız.

### Kısaca

- `updateAndGet` compare-and-set döngüsünü sizin için çalıştırır; fonksiyonunuz dahil.
- 8 thread'de fonksiyon 8.000.000 güncelleme için 31.339.201–39.623.599 kez çalıştı.
- 1 thread'de çağrılar ve güncellemeler eşitti: her biri 1.000.000.
- Fonksiyonu saf tutun: log yok, I/O yok, kendine ait sayaç yok.

---

## Kilit Yok, Bekleme Yok Demek Değil

Önceki bölüm fonksiyona yapılan çağrıları saydı. Bu bölüm denemelerin kendisini sayıyor: kendi başarısızlıklarını sayan ve başka hiçbir şey yapmayan bir compare-and-set döngüsü, thread başına bir milyon artırma, 1, 2, 4 ve 8 thread'le.

```
1 thread : 0.00 failed per success, worst 1
2 threads: 0.72 failed per success, worst 2092
4 threads: 0.89 failed per success, worst 849
8 threads: 2.20 failed per success, worst 6694
```

Her satır, o thread sayısı için beş çalıştırmanın beşincisi. Tek thread'de hiçbir şey başarısız olmadı. Sekizde, başarılı her denemeye karşılık bir ila iki deneme başarısız oldu; beş çalıştırmada 1,11 ile 2,20 arasında. En kötü tekil artırma çalıştırmadan çalıştırmaya çok değişiyor; bir çalıştırmada 6.694 deneme sürdü.

Sebebi, her thread'in aynı bellek konumu için kavga etmesi ve aynı anda yalnızca bir denemenin kazanabilmesi. İlk Java yazısı donanımın önbellekleri eşit tuttuğunu göstermişti: bir çekirdek yazar, diğerlerine haber verilir. Burada sekiz thread'in hepsi aynı anda o tek konum üzerinde çalışıyor.

Hiçbir thread bir kilit beklemiyor, ama her thread kazanma sırasını bekliyor. Ve bunu hiçbir şey göstermiyor. İşte sekiz thread dönerken alınmış bir thread dump:

```
dump: RUNNABLE 8/8, waiting to lock 0, parked 0
dump: deadlock reported: no
```

Sekizi de `RUNNABLE`. Hiçbir şey bir kilit beklemiyor, hiçbir şey park edilmemiş, deadlock yok. `synchronized` yazısında dump doğrudan soruna işaret ediyordu. Burada işaret edilecek hiçbir şey yok. Bu tür bir çekişmeyi ancak sayarsanız görürsünüz.

### Kısaca

- Hiçbir thread kilit beklemedi, yine de 8 thread'de her başarıya karşılık 1,11–2,20 deneme başarısız oldu.
- Tek bir artırma 6.694 deneme sürdü.
- Bir thread dump 8 thread'in hepsini RUNNABLE gösterdi, bekleyen hiçbir şey yoktu. Bunu ancak sayarsanız görürsünüz.

---

## LongAdder: Tek Hücre İçin Kavgayı Bırakın

Herkes tek bir hücre için kavga ediyorsa onlara daha çok hücre verin. İlk Java yazısı *"Sayaç sıcak ve yoğun çekişme altındayken `LongAdder`"* diye saymış ve onun kendi yazısını hak ettiğini söylemişti.

Fikir basit. Thread'ler yarıştığında bir `LongAdder` sayımı birkaç değişkene dağıtır, böylece farklı thread'ler farklı değişkenleri günceller. Okumak onları toplar.

Bu ne kadar hızlı? Bu yazıda bunun için bir benchmark yok ve yazı tahmin yürütmeyecek. Belgeler beklentiyi şöyle koyuyor: *"Düşük güncelleme çekişmesi altında iki sınıfın özellikleri benzerdir. Ama yüksek çekişme altında bu sınıfın beklenen iş hacmi, daha yüksek alan tüketimi pahasına, belirgin biçimde daha yüksektir."*

Bedeli okumada. Belgeler `sum()` için şöyle diyor: *"Döndürülen değer atomik bir anlık görüntü DEĞİLDİR; eşzamanlı güncellemelerin yokluğunda çağrılırsa doğru bir sonuç döndürür, ama toplam hesaplanırken gerçekleşen eşzamanlı güncellemeler hesaba katılmayabilir."* Sınıf açıklaması neye yaradığını zaten söylüyor: istatistikler, *"ince taneli senkronizasyon denetimi için değil."*

Öyleyse başa dönelim: **bir bakiye asla bir `LongAdder` değildir.** compare-and-set'i yoktur: toplayabilir, ama yalnızca bir kontrol hâlâ geçerliyse yazamaz. Ve `sum()`, toplarken gerçekleşen güncellemeleri kaçırabilir.

### Kısaca

- `LongAdder` sıcak bir sayacı birkaç değişkene dağıtır ve okuduğunuzda onları toplar.
- Belgeleri yoğun çekişme altında çok daha yüksek iş hacmi bekliyor; bedeli bellekle ödeniyor.
- compare-and-set'i yoktur ve `sum()` bir anlık görüntü değildir. Harekete geçmeden önce kontrol ettiğiniz bir değer için onu asla kullanmayın.

---

## compareAndSet Gerçekte Neyi Karşılaştırır

`compareAndSet` tek bir soru sorar: değer hâlâ okuduğum değer mi? Cevabın sizi yanıltabileceği iki yol var.

**Referansları karşılaştırır.** Bir `AtomicReference` için yazma *"geçerli değer `== expectedValue` ise"* gerçekleşir; `equals()` değil, `==`. İçine kutulanmış (boxed) sayılar koyun ve 127 tutan bir referansta `compareAndSet(127, 128)`, sonra 1000 tutan birinde `compareAndSet(1000, 1001)` deneyin:

```
default JVM:   CAS(127) = true  CAS(1000) = false
cache 1000:    CAS(127) = true  CAS(1000) = true
```

Varsayılan bir JVM'de 127 eşleşti, 1000 eşleşmedi. JVM küçük değerler için tek bir `Integer` nesnesini yeniden kullanır, dolayısıyla iki `127` aynı nesnedir; her `1000` ise yeni bir nesne. İkinci satır, daha büyük bir önbellekle aynı program:

```
java -XX:AutoBoxCacheMax=1000 IdentityTrap cache1000
```

Artık 1000 de eşleşiyor. Dil, paylaşılan bir nesneyi yalnızca -128 ile 127 arasında garanti eder; ötesi JVM'e bağlıdır. Sayılar için `AtomicInteger` bu soruyu tamamen ortadan kaldırır. Kural kısa: beklenen değer olarak eşit görünen yeni bir değeri değil, **okuduğunuz referansı verin**.

**Geçmişi göremez.** Bir thread 100'lük bir bakiye okur ve 70 yazmak üzeredir. O yazmadan önce başka bir thread bakiyeyi 50'ye, sonra yeniden 100'e değiştirir. İlk thread'in `compareAndSet(100, 70)`'i başarılı olur; değer aynı. Ama arada biri ona dokundu. "Aynı değer" ile "kimse dokunmadı" farklı önermelerdir. Bu, **ABA problemidir**. Düz bir sayı için zararı yok: 70 yine doğru sonuç. Değer kendisinden fazlasını temsil ettiğinde önemlidir; "okuduğumdan beri hiçbir şey değişmedi" sizin uyguladığınız kural olduğunda.

`AtomicStampedReference` değerin yanında bir tamsayı damga tutar ve ikisini birlikte karşılaştırır. Her yazan damgayı ilerletmek zorundadır, böylece bir değişiklik ve onun geri alınması yine de iz bırakır:

![Animasyon: A thread'i 0 damgalı 100'lük bir bakiye okuyor ve duraklıyor. Başka bir thread bakiyeyi 50'ye ve yeniden 100'e değiştiriyor, damga 2'ye ilerliyor. 100'den 70'e düz bir compareAndSet başarılı oluyor. Damgalı compareAndSet başarısız oluyor, çünkü damga 0 değil 2.](./aba.gif "Değerleri karşılaştırmak size değerin aynı olduğunu söyler, kimsenin ona dokunmadığını değil.")

```
plain   : CAS(100 -> 70) = true
stamped : CAS(100 -> 70) = false (stamp 0, now 2)
```

Sürüm sütunu da aynı damgadır. `WHERE balance = ?` 100 -> 50 -> 100'ü fark etmezdi. `WHERE version = ?` ederdi.

### Kısaca

- Bir `AtomicReference` üzerindeki `compareAndSet` `equals()`'u değil, referansları karşılaştırır.
- Varsayılan bir JVM'de 127 eşleşti, 1000 eşleşmedi. Okuduğunuz referansı verin.
- 100 -> 50 -> 100'ü göremez. `AtomicStampedReference` görebilir: damga 0'dı, artık 2'ydi.
- Sürüm sütunu da aynı damgadır.

---

## Tek Değişken Yetmediğinde

Paket belgeleri kendi sınırını ilk cümlesinde söylüyor: *"Tek değişkenler üzerinde kilitsiz, thread güvenli programlamayı destekleyen küçük bir sınıf araç takımı."* **Tek değişkenler.**

Bir sınırlayıcı düşünün: zaman penceresi başına en çok 10 istek. İki değer tutar: geçerli pencerenin ne zaman başladığı ve kaç isteği geçirdiği. Yeni bir pencere başladığında ikisi birlikte değişmelidir.

İki `AtomicLong` ile her çağrı atomiktir, karar değildir. Birkaç thread yeni pencereyi aşağı yukarı aynı anda görür ve her biri başlangıcı ayarlayıp sayımı sıfırlar. Diğer thread'ler zaten saydıktan sonra gelen bir sıfırlama onların sayımlarını siler. Sayım baştan başlar ve daha fazla istek geçer.

Sekiz thread aynı pencereye dörder istek gönderiyor: 32 deneme, en çok 10'u geçmeli. On bin pencere, beş çalıştırmadan ikisi, sonra çözüm:

```
two-atomics over limit in 797/10000 windows, most 32
two-atomics over limit in 600/10000 windows, most 31
one-record  over limit in 0/10000 windows, most 10
```

`most 32`, en az bir pencerede her bir isteğin geçtiği anlamına gelir.

Çözüm iki değeri tek bir değişmez record'a koyar ve bütünü tek seferde değiştirir:

```java
record Window(long start, int count) {}

public boolean tryAcquire(long now) {
    while (true) {
        Window w = window.get();
        Window next;
        if (w.start() != now) next = new Window(now, 1);
        else if (w.count() >= LIMIT) return false;
        else next = new Window(now, w.count() + 1);
        if (window.compareAndSet(w, next)) return true;
    }
}
```

Para çekmeyle aynı döngü: oku, karar ver, compare-and-set, başarısızlıkta baştan başla. İki değer tek bir yazmayla değişir, dolayısıyla hiçbir thread birini diğeri olmadan görmez. Beklenen değerin `w` olduğuna, yani okunan referans olduğuna dikkat edin; önceki bölümün kuralı. Aynı alanlara sahip yeni bir `Window` asla eşleşmezdi.

Bu, bir `Window` oluşturmak ucuz ve yan etkisiz olduğu için çalışıyor. Güncelleme pahalıysa her başarısız deneme onu tekrarlar. Yan etkileri varsa onlar da tekrarlanır. O zaman `synchronized` yazısındaki gibi küçük bir kilit dürüst cevaptır.

### Kısaca

- Atomik sınıflar tek bir değişkeni korur. Birlikte değişmesi gereken iki alan tek bir karardır.
- İki `AtomicLong`, 10.000 pencerenin 600–797'sinde 10'luk sınırın aşılmasına izin verdi, 32'ye kadar.
- Bir `AtomicReference` arkasında tek bir değişmez record: her çalıştırmada sınırı aşan pencere 0.
- Güncelleme pahalıysa ya da yan etkileri varsa, küçük bir kilit dürüst cevaptır.

---

## Kilit mi, Atomik mi, Hiçbiri mi

- **Tek sayaç, az yazan:** `AtomicInteger` ya da `AtomicLong`
- **Tek sayaç, çok yazan, seyrek okunan:** `LongAdder`
- **Kontrol et, sonra tek bir değer yaz:** bir `compareAndSet` döngüsü ya da saf bir fonksiyonla `updateAndGet`
- **Birkaç değer, tek kural:** bir `AtomicReference` içinde tek bir değişmez record ya da bir kilit
- **Güncellemede yan etkiler:** bir kilit

`synchronized` yazısı *"En hızlı kilit, almadığınız kilittir"* ile bitmişti. Bu hâlâ doğru, ama almadığınız kilidin maliyeti ortadan kalkmaz. Döngünün içine taşınır: başarısız denemeler, iki kez çalışan fonksiyonlar, hiçbir thread dump'ın göstermediği çekişme.

Bu yazıdaki her compare-and-set döngüsü yalnızca belleğe dokunan bir yeniden denemedir. Bir sonraki yazı bir veritabanına, bir ağa ve birinin parasına dokunan yeniden denemeler hakkında; ve onları iki kez çalıştırmayı neyin güvenli kıldığı.

### Kısaca

- Tek değer, tek kural: bir atomik sınıf. Kontrol et, sonra yaz: bir compare-and-set döngüsü.
- Sıcak sayaçlar: `LongAdder`, kontrol ettiğiniz bir değer için asla.
- Birkaç değer: tek bir değişmez record ya da bir kilit.

---

## Kaynaklar

**API belgeleri**

- *java.util.concurrent.atomic — package summary.* "Tek değişkenler" cümlesi.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/package-summary.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/package-summary.html)
- *AtomicInteger* — `compareAndSet`, `getAndIncrement`, `updateAndGet` ve yan etkisizlik kuralı.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicInteger.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicInteger.html)
- *AtomicReference* — `==` ile `compareAndSet`.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicReference.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicReference.html)
- *AtomicStampedReference* — birlikte güncellenen bir referans ve bir tamsayı damga.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicStampedReference.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicStampedReference.html)
- *LongAdder* — çekişme ile bellek arasındaki ödünleşim ve anlık görüntü olmayan `sum()`.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/LongAdder.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/LongAdder.html)
- *Integer.valueOf* — hangi kutulanmış değerlerin paylaşılması garanti edilir.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)

**İleri okuma**

- Brian Goetz et al., *Java Concurrency in Practice*, 15. bölüm — *Atomic Variables and Nonblocking Synchronization.*
- Martin Kleppmann ve Chris Riccomini, *Designing Data-Intensive Applications*, 2. baskı, 8. bölüm — koşullu yazmalar (compare-and-set).
