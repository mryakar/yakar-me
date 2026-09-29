---
title: "equals() Metodunun En İyi Arkadaşı: hashCode()"
description: "Bu yazıda equals() ve hashCode() metotları arasındaki dostluk hakkında bolca bilgi var. Yine de yazı esas olarak hashCode() hakkında."
short: "equals()'ın En İyi Arkadaşı"
mediumUrl: https://medium.com/havelsan/the-best-friend-of-equals-method-hashcode-79a8a352da15
---

Java programlamada **hashCode()** ve **equals()** metotlarının karşılıklı bir sözleşmesi (contract) vardır ve birbirlerinden bağımsız olarak da işlev göremezler; **birbirlerine bağımlıdırlar**. Bu ortakyaşar ilişki, sınıf tanımlarında ikisinin birlikte ve uyum içinde uygulanmasının temel gerekliliğini belirler, çünkü nesne karşılaştırmalarında ve hash tabanlı veri yapılarında birbirini tamamlayan roller üstlenirler.

Gerçekten de **hashCode()** ve **equals()** metotları bir sınıf tanımı içinde ayrılmaz yol arkadaşları olarak kabul edilir. Bir sınıfta birlikte bulunmaları, fark edilmesi ve düzeltilmesi zor olabilecek pek çok hatanın önüne geçmek için kritik önemdedir. İki metodun birlikte var olması, nesne karşılaştırmalarının ve hash tabanlı veri yapılarının kapsamlı ve doğru biçimde ele alınmasını sağlar ve kod tabanının güvenilirliğine ve bütünlüğüne önemli ölçüde katkıda bulunur.

Bu yazıda Java programlama dilindeki **hashCode()** metodunun ayrıntılarına dalacağız. Başlangıç olarak, bu konuyu anlamak için gerekli temel tanımları inceleyerek zemini hazırlayacağız. Bu tanımları daha karmaşık ve kritik kavramlarla pekiştirmek önemlidir.

Ardından Java'da hashing mekanizmasının uygulanmasına dalacak ve **hashCode()** metodunu çevreleyen ayrıntıları inceleyerek Java çalışma ortamında nasıl işlediğini ortaya koyacağız. Son olarak **equals()** ve **hashCode()** metotları arasındaki ayrılmaz bağı keşfedeceğiz. Bu inceleme, belirli veri yapılarını anlamayı ve bu metotların bu yapılar içinde nasıl eşgüdüm içinde çalıştığını ve birbirini nasıl tamamladığını açıklamayı içerecek.

Bu yazıda ele alınan kavramlarla Java programlamadaki “**equals()** metodu” arasında güçlü bir bağ var gibi görünüyor. “equals() metodunu” anlamak, [**bu**](https://medium.com/@mr-yakar/how-to-write-equals-in-java-5e9a908045a1) yazıda ele alınan içeriği kavramak için çok önemlidir. “equals() metodu” konusunda bilgili değilseniz, burada durup önce o içeriği tanımanızı öneririm. Aralarındaki yakın ilişki nedeniyle, burada ele alınan konuları anlamanızı önemli ölçüde artıracaktır.

Girişe bazı tanımlar vererek başlayalım.

---

## Hashing Nedir?

Basitçe söylemek gerekirse hashing, bir veri kümesini başka bir biçime dönüştürme işlemidir. Özünde bir değeri başka bir değere dönüştürmeyi içerir. Ortaya çıkan dönüştürülmüş değer geri çevrilemez ve genellikle “hash” olarak adlandırılır.

## Hash Fonksiyonu Nedir?

[Wikipedia](https://en.wikipedia.org/wiki/Hash_function)'ya göre;

> Hash fonksiyonu, keyfi boyuttaki verileri sabit boyutlu değerlere eşlemek için kullanılabilen herhangi bir fonksiyondur.

Özünde bir hash fonksiyonu, matematiksel hashing algoritmalarından birini kullanarak sabit boyutta bir dönüştürülmüş değer üretmek üzere tasarlanır. Bunun yanında, değişken boyutlarda dönüştürülmüş değerler üretebilen belirli algoritmalar da vardır.

Bir hash fonksiyonu örneği olarak aşağıdaki ‘h’ fonksiyonunu ele alalım:

> h(k) = k (mod 10)

*k* anahtarı (key) temsil ettiğine göre, aşağıdaki hash'ler üretilir;

> h(1) = 1

> h(12) = 2

> h(896543) = 3

Elbette veri dönüşümleri için çeşitli matematiksel algoritmalar kullanılır. Ancak bir yöntem, dönüştürülmüş verinin doğrudan özgün biçimine geri getirilmesine izin veriyorsa hashing ilkeleriyle örtüşmez; bunun yerine kodlama/kod çözme (encoding/decoding) kategorisine girer ve bu ayrı bir tartışma konusu olabilir.

Benzer şekilde, veri dönüşümü için benzersiz bir anahtar kullanılıyor ve veriyi özgün durumuna döndürmek için aynı ya da farklı başka bir anahtar gerekiyorsa, bu işlem şifreleme/şifre çözme (encryption/decryption) olarak bilinir. Bu kavramlar hashing'in temel özelliklerinden ayrılır ve ayrı bir yazıda incelenebilir.

Bir hash fonksiyonu **tek yönlü** bir algoritmayla çalışır; yani veri **geri çevrilemez biçimde** başka bir biçime dönüştürülür. Bu geri çevrilemez dönüşüm, özgün verinin geri elde edilmesini engeller. Daha önce bahsedilen ‘h’ fonksiyonunda örneğin matematikteki mod işlemi geri çevrilemez bir işlemdir. Örneğin hem 12 mod 10 hem de 22 mod 10 sonucu 2'dir; bu da 12 ve 22 gibi farklı değerlerin çıktıdan tek bir şekilde elde edilemeyeceğini gösterir.

Ancak farklı anahtarlar için aynı sonuçların üretilmesi, hashing'de hash çakışması (hash collision) olarak adlandırılan önemli bir sorun oluşturur. Çakışmaya ilişkin ayrıntılar ilerideki bölümlerden birinde açıklanacaktır.

Bir hashing algoritmasının kalitesi ve uygunluğu, benzersiz sonuçlar üretebilme, geri çevrilemezlik ve hash'in hızlı hesaplanması gibi birkaç kritik özelliğe bağlıdır. Bu özellikler, hashing amacıyla kullanılan bir matematiksel dönüşüm algoritmasının etkinliğini ve güvenilirliğini belirlemede kilit rol oynar.

Gerçekten de hashing pek çok fayda sağlar ve matematik, veri güvenliği, elektronik iletişim ve daha fazlası gibi çeşitli alanlarda yaygın olarak kullanılır. Bu alanların her biri hashing tekniklerinden kendi özel gereksinimlerine göre yararlanır.

Bilgisayar biliminde hashing, veri yapılarıyla, özellikle de hash tablolarıyla birlikte belirgin biçimde kullanılır. Hash tablosu veri yapısının inceliklerini keşfetmek, hashing'in nasıl uygulandığına ve bilgisayar bilimi alanındaki önemine ışık tutacaktır.

## Hash Tablosu Nedir?

[Wikipedia'ya göre;](https://en.wikipedia.org/wiki/Hash_table)

> Bilgisayar biliminde hash map olarak da bilinen hash tablosu, bir ilişkisel diziyi (associative array) ya da sözlüğü gerçekleyen bir veri yapısıdır. Anahtarları değerlere eşleyen soyut bir veri türüdür. Hash tablosu, istenen değerin bulunabileceği kovalardan (bucket) ya da yuvalardan oluşan bir diziye, hash kodu da denen bir indeks hesaplamak için bir hash fonksiyonu kullanır. Arama sırasında anahtar hash'lenir ve ortaya çıkan hash, karşılık gelen değerin nerede saklandığını gösterir.

Kısacası bir hash tablosu, hash'lenmiş biçimdeki anahtarlardan ve bunlara karşılık gelen değerlerden oluşur. Wikipedia'da açıklanan aşağıdaki hash tablosu örneğini inceleyelim:

![Diyagram: John Smith, Lisa Smith ve Sandra Dee anahtarları bir hash fonksiyonundan geçerek telefon numaralarını tutan numaralı kovalara gider.](./hash-table.png)

*Hash tablosu olarak küçük bir telefon rehberi — görsel: Jorge Stolfi, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Hash_table_3_1_1_0_1_0_0_SP.svg) üzerinden.*

Açıklamadan da anlaşıldığı gibi, kişinin tam adı hash fonksiyonu tarafından işlenerek çıktı üretilir ve bu çıktı hash tablosunda anahtar olarak kullanılır. Bu arada kişinin telefon numarası da karşılık gelen değer olarak saklanır. Hash tablosunun başlıca avantajlarından biri, arama, ekleme ve silme işlemlerinin zaman karmaşıklığının O(1) olmasıdır; bu da neredeyse anlık işlem anlamına gelir.

## Hash Çakışması Nedir?

Yazının başında verilen ilk örneğe dönersek, ‘h’ olarak gösterilen hash fonksiyonu, özünde anahtarın 10'a bölümünden kalanı bularak hash'i hesaplar.

> h(k) = k (mod 10)

Bu bağlamda 10 değeri tablonun boyutunu temsil eder. Bu belirleme, üretilen hash'in her zaman tablo boyutunun tanımladığı sınırlar içinde kalmasını sağlar.

Wikipedia'daki temel hash tanımını inceleyelim. Bir hash fonksiyonu keyfi boyutlarda girdiler alır ve sabit boyutta bir çıktı üretir. Bu sabit çıktı boyutu tablonun boyutuna karşılık gelir ve bu da tabloda değerleri saklamak için kullanılabilecek belleğe bir sınır koyar. Sonuç olarak farklı girdilerin aynı hash değerini vermesi mümkündür. Bu kavramı açıklamak için bir örnek:

> h(1) = 1

> h(121) = 1

> h(1653552771) = 1

Bu gözlem, ‘h’ olarak gösterilen hash fonksiyonunun farklı anahtar değerleri için aynı hash sonucunu ürettiğini gösteriyor. Bu durum, hash fonksiyonunun özelliklerinden ve hash tablosunun boyutunun 10 olarak belirlenmesinden kaynaklanır. Bu olguya genellikle “**hash çakışması**” (hash collision) denir. Hash çakışmaları hem güvenlik hem de performans açısından önemli zorluklar yaratır.

Anlatılan senaryo, kullanıcı parolalarının hash değerleri olarak saklandığı bir web sitesinin giriş sayfasını içeriyor; hash fonksiyonlarının geri çevrilemez doğası nedeniyle bu, herhangi birinin özgün düz metin parolalara erişmesini zorlaştırır. Ancak hash fonksiyonu kötü tasarlanmışsa, kötü niyetli kişilerin istismarına açık hale gelir. Böyle bir durumda kötü niyetli bir aktör, hash çakışmaları oluşturmak için hash fonksiyonundaki zafiyetlerden yararlanabilir.

Saldırgan bu çakışmaları üreterek başka birinin hesabıyla web sitesine giriş yapmayı deneyebilir. Kötü tasarlanmış bir hash fonksiyonuyla çakışma oluşturmak görece kolaylaşır. Dahası, bazı durumlarda saldırgan, hash fonksiyonunun tasarımındaki zayıflıklardan yararlanarak özgün parolayı doğrudan kaba kuvvet (brute-force) saldırılarıyla kırmayı bile deneyebilir.

Bu senaryo, kullanıcı parolaları gibi hassas bilgileri güvence altına alırken sağlam, iyi tasarlanmış hash fonksiyonları kullanmanın kritik önemini vurgular. İyi tasarlanmış bir hash fonksiyonu, kötü niyetli istismar ve kullanıcı hesaplarına yetkisiz erişim riskini önemli ölçüde azaltır.

Hiç ya da çok az hash çakışmasının olduğu durumlarda, bu dizilerde arama işlemi teorik olarak **O(n)** olsa bile hızlıdır, çünkü diziler görece küçüktür. Ancak çakışma sayısı arttıkça, yani daha az sayıda farklı hash değeri ve daha büyük ilişkisel diziler ortaya çıktıkça, doğru anahtar-değer çiftini bulmanın zaman karmaşıklığı verimli **O(1)**'den daha az verimli **O(n)**'ye kayabilir. Bu, özellikle büyük miktarda veriyle sorunlu hale gelir.

Hash fonksiyonu performansını en iyilemek için çakışmaları ilişkisel dizilere eşit biçimde dağıtmayı amaçlayan ilgi çekici bir matematiksel yaklaşımdan söz ediliyor. Ancak bu kavram ayrı bir yazıda ele alınacak.

Gerçekleşme olasılığı algoritmadan algoritmaya değişir. Bazı temel bilgilere geçelim;

[**CRC-32:**](https://en.wikipedia.org/wiki/Cyclic_redundancy_check) Hash çakışması riski en yüksek olanıdır. Halihazırda 77163 hash değeri varsa hash çakışması olasılığı %50'dir; bu da diğer algoritmalara göre son derece yüksektir.

[**MD5:**](https://en.wikipedia.org/wiki/MD5) En yaygın kullanılan hash algoritmasıdır. Halihazırda 5,06 milyar hash değeri varsa hash çakışması yaşanma olasılığı %50'dir; bu da CRC-32'den makul ölçüde daha iyidir.

[**SHA-1:**](https://en.wikipedia.org/wiki/SHA-1) Bu üç algoritma arasında en düşük hash çakışması riskini sunar. SHA-1 algoritmasında %50'lik hash çakışması riskine ulaşmak için halihazırda 1,42 × 10²⁴ hash değeri olmalıdır.

Java açısından hashing ile devam edelim.

---

## Java'da Hash Fonksiyonu

Hashing mekanizması ve bazı olası hash algoritmaları ele alındığına göre, aşağıdaki bölüm doğrudan Java programlama dilindeki hashing mekanizmasına odaklanacak.

Java programlama dilinde hashing mekanizması, **java.lang.Object** sınıfının bir parçası olan **hashCode()** adlı bir metotla sağlanır. Bu metodun nasıl kullanılacağının ayrıntılarına dalmadan önce, gerçek uygulamasına ilişkin bazı ayrıntıları inceleyelim.

Java'daki hash fonksiyonu, üzerinde çalıştığı **Java Sanal Makinesine (Java Virtual Machine, JVM)** **bağlıdır**. Bu, bir JVM'nin bir değer hesaplarken başka bir JVM'nin farklı bir değer hesaplayabileceği anlamına gelir. Bunun nedeni basittir: **hashCode()** metodu aslında Java dışında bir dilde yazılmış bir native metottur. Bu fonksiyon JVM içindeki iç kütüphaneler tarafından sağlanır ve bu kütüphaneler bir JVM'den diğerine farklılık gösterebilir. **java.lang.Object** içindeki **hashCode()** metodunun gerçek imzasını incelemek isterseniz aşağıdaki kod parçasına bakın:

```java
public native int hashCode();
```

Bu kod parçası, **java.lang.Object** sınıfındaki **hashCode()** metodunun imzasını gösteriyor ve native olarak uygulandığını belirtiyor.

Java programlama dilinde “native”, Java'da yazılmamış harici bir kütüphaneden fonksiyonlar entegre edilirken kullanılan ayrılmış bir sözcüktür. Gerçek uygulama farklı Java Sanal Makinelerinde (JVM) değişebileceğinden, bu olası uygulamaların karmaşık ayrıntıları bu yazıda atlanacak; bunlar ayrı bir tartışmayı hak ediyor.

Aşağıdaki bölüm, doğrudan bu yazının konusunu ilgilendirdiği için temeldir ve atlanamaz. **hashCode()** metodu belirli bir sözleşmeye uyar.

### Hash Değerinin Tutarlılığı

Resmî belgeler, uygulamanın mevcut çalışması sırasında çağrılar aynı nesne üzerinde yapıldığı sürece **hashCode()** metodunun hash değeri olarak tutarlı biçimde aynı tamsayıyı döndürmesi gerektiğini belirtir. Halihazırda uygulanmış ‘Pencil’ adlı bir sınıfı ele alalım. Programı çalıştırdığımızı, ‘Pencil’ sınıfından bir nesne oluşturduğumuzu ve ardından nesne üzerinde **hashCode()** metodunu aşağıdaki gibi iki kez çalıştırdığımızı düşünelim:

```java
Pencil a = new Pencil();
```

```
int firstHashCodeCalculation = a.hashCode();
int secondHashCodeCalculation = a.hashCode();
```

```
boolean same = firstHashCodeCalculation == secondHashCodeCalculation;
```

En son tanımlanan ‘same’ değişkeni, **hashCode()** sözleşmesinin ilk ilkesine uygun olarak ‘true’ değerine sahip olmalıdır. Bu ilke son derece önemlidir, çünkü **hashCode()** metodu uygulamamızda tutarsız değişkenlerin dışarıda bırakılmasını şart koşar. Örneğin **java.util.Random**'dan gelen bir değeri dahil etmek yanlıştır. Benzer şekilde hash değerinin hesaplanmasına **java.util.Date**'ten bir değişken eklemek de sürekli değişen değerler üretebileceği için yanlış bir uygulama örneğidir.

### equals() ve hashCode() Metotlarının Tutarlılığı

> İlişkiler güvenilirlik, dürüstlük ve tutarlılıkla beslenir.
>
> — Scott Borchetta

**hashCode()** sözleşmesinin ikinci ilkesi, iki nesne **equals()** metoduna göre eşit kabul ediliyorsa hash değerlerinin de aynı olması gerektiğini şart koşar. Bu yön, **hashCode()** metodumuzun uygulamasının kalitesine bağlıdır. Bunu sağlamak, hem **hashCode()** hem de **equals()** metotlarında aynı özellikleri kullanmayı gerektirir. Kullanılmayan özelliklerdeki herhangi bir değişiklik, **hashCode()** ya da **equals()** metodunda farklı bir sonuca yol açmaz.

Bu ilkenin özü, hash tabanlı koleksiyonların kullanımında yatar. Şimdi varsayımsal ‘Pencil’ sınıfımıza geri dönelim. Bu senaryoda sınıfın üç ayrı özelliği olduğunu varsayalım: ‘brand’, ‘color’ ve ‘size’. Bu özelliklerin hepsi **equals()** metoduna dahil edilmiş, ancak **hashCode()** metodu için bir uygulama sağlamamışız. Başka bir deyişle, **equals()** metodunda kullanılan özelliklerin hiçbiri kullanılmamış. Aşağıdaki kod parçası şöyle:

```java
Pencil a = new Pencil("Rotring", "Black", 0.5);
Pencil b = new Pencil("Faber Castell", "Black", 0.5);
Pencil c = new Pencil("Faber Castell", "Red", 1.0);

Map<Pencil, Integer> pencilPriceMap = new HashMap<>();
pencilPriceMap.put(a, 100);
pencilPriceMap.put(b, 120);
pencilPriceMap.put(c, 150);

int price = pencilPriceMap.get(new Pencil("Rotring", "Black", 0.5));
```

Fiyatın 100 olacağını varsayabiliriz, ama öyle olmayacak. İşte sorunlarla karşılaştığımız yer burası. Pencil sınıfının nesnelerini bir hash map'te anahtar olarak kullanmak istiyorsak **hashCode()** metodunu override etmeli ve **equals()** metodunda kullanılanlarla aynı özellikleri kullanmalıyız.

### hashCode() Metodunun Bir Performans Ölçütü

> Kendinizi görme biçiminizle bağdaşmayan bir şekilde istikrarlı olarak performans gösteremezsiniz.
>
> — Zig Ziglar

Son ilke, iki nesne ilgili sınıfın **equals()** metoduna göre eşit değilse ortaya çıkan hash kodlarının farklı olmak zorunda olmadığını söyler. Ancak performans kaygıları nedeniyle farklı olmaları daha iyidir.

Bu yazının başında hash çakışmalarının nasıl oluştuğu hakkında bilgi verdik. Burada da benzer bir durumla karşılaşıyoruz. Bir kez daha varsayımsal ‘pencil’ sınıfımıza dönelim. Önceki ilkedekiyle aynı özelliklere sahip, ancak bu sefer **hashCode()** metodu farklı ya da eşit bütün nesneler için tutarlı biçimde aynı hash'i hesaplıyor. Bunu göstermek için aşağıdaki kod parçası şöyle:

```java
Pencil a = new Pencil("Rotring", "Black", 0.5);
Pencil b = new Pencil("Faber Castell", "Black", 0.5);
Pencil c = new Pencil("Faber Castell", "Red", 1.0);

Map<Pencil, Integer> pencilPriceMap = new HashMap<>();
pencilPriceMap.put(a, 100);
pencilPriceMap.put(b, 120);
pencilPriceMap.put(c, 150);

pencilPriceMap.get(new Pencil("Rotring", "Black", 0.5));
```

Hash map'in anahtarı nesnenin hash kodundan türetildiğine göre, bütün nesnelerin anahtarları aynı olduğu ve aynı kovaya eklendikleri için bir get işleminin zaman karmaşıklığı **O(1)**'den **O(n)**'ye kayar; bu da haritamızı fiilen bir listeye dönüştürür. Bu, önemli bir performans kaybıyla sonuçlanır.

Çalışma zamanındaki mantığı etkilemez, ama performansı etkiler. Bir hash tablosu kullanmanın faydasını görmek için, **hashCode()** sözleşmesinin üçüncü ilkesini ihlal etmeyen bir **hashCode()** uygulaması sağlamamız gerektiği açıktır.

---

## Sonuç Olarak

Açıkça görüldüğü gibi **hashCode()** ve **equals()** metotları ayrılmaz bir ikili oluşturur ve kodunuzu yazarken çok ciddiye alınmalıdır. Web'de pek çok kaynak var; yalnızca bu yazıya güvenmemenizi, başka kaynakları da incelemenizi öneririm.

Her zamanki gibi, okuduğunuz için teşekkürler!
