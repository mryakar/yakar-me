---
title: "Java'da equals() Nasıl Yazılır"
description: "Java'da equals() metodunun önemini anlamak için bir yazı. Metodun uygulanmasına dair ustalık düzeyinde ayrıntılar sunuyor."
short: "equals() Nasıl Yazılır"
mediumUrl: https://medium.com/havelsan/how-to-write-equals-in-java-5e9a908045a1
---

Bu yazının sonunda, Java programlama dilinde en iyi equals() metodunu yazabilmek için gereken bütün bilgiler ele alınmış olacak. ***equals()*** metodunun en iyi uygulamasını (best practice) kullanmak için gereken temel bilgileri kapsamak amacıyla eşitliğin ayrıntıları hem matematiksel tanım açısından hem de Java programlama dilinin yaklaşımıyla ele alınacak.

---

## Eşitliğin Matematiksel Tanımı

[Wikipedia](https://en.wikipedia.org/wiki/Equality_%28mathematics%29#:~:text=In%20mathematics%2C%20equality%20is%20a,and%20pronounced%20A%20equals%20B.)'ya göre matematiksel eşitliğin tanımı şudur:

> Matematikte eşitlik, iki nicelik ya da daha genel olarak iki matematiksel ifade arasındaki, niceliklerin aynı değere sahip olduğunu ya da ifadelerin aynı matematiksel nesneyi temsil ettiğini öne süren bir ilişkidir. *A* ile *B* arasındaki eşitlik *A* = *B* biçiminde yazılır ve “*A* eşittir *B*” diye okunur.

## Java'da Eşitliğin Tanımı

Java programlama dilinde eşitlik basitçe aynı değere sahip olmak demektir. Bazen kelimenin tam anlamıyla aynı değere sahip olmak, bazen de nesnenin özellikleri açısından aynı yapıya sahip olmak kastedilir.

İki ilkel (primitive) tip değerinin eşitliğini kontrol etmek gerektiğinde, aşağıdaki örnekte olduğu gibi doğrudan eşittir işareti kullanılır;

```java
int a = 5;
int b = 6;
int c = 5;

// Prints "false" since a and b do not have the same value.
System.out.println(a == b);

// Prints "true" since a and c have the same value.
System.out.println(a == c);
```

Bu kod parçasında tamsayı ilkel tipi kullanıldı. Ancak diğer ilkel tipler için de durum aynıdır.

---

Öte yandan bazen iki nesnenin eşitliğini kontrol etmek gerekir. Nesneler açısından, iki nesnenin eşitliğini kontrol etme sürecinin farklı aşamalarında kullanılan iki farklı yaklaşım vardır. Ayrıntılara girelim.

### Referans Eşitliği

Java programlama dilinde nesnelerin gerçek değerleri bellekte bir yerde saklanır ve bunları, yine bellekte bir yerde saklanan nesne referansları gösterir. Aşağıdaki kod parçasına bakalım;

```java
// Create an object with "new" operator.
// Point to object with object reference "a".
Object a = new Object();

// Create another object reference.
// Point to the same object as the reference "a" is pointing.
Object b = a;

// Output is true.
System.out.println(a == b);

// Create another object with "new" operator.
// Point to object with object reference "b".
b = new Object();

// Output is false.
System.out.println(a == b);
```

Java programlama dilinde “new” operatörü bir nesne oluşturur ve nesnenin bellekteki gerçek konumunu gösteren bir referans döndürür. Çalışma zamanında aynı nesneyi gösteren pek çok nesne referansı oluşturulabilir. Referans eşitliği açısından, iki nesne referansının aynı bellek konumunu gösterip göstermediği kontrol edilir.

Böyle bir senaryoda “a” ve “b” aslında aynı nesneyi gösteren iki referanstır; dolayısıyla referans eşitliği sağlandığı için doğrudan “a”nın “b”ye eşit olduğu söylenebilir.

Ancak tersi senaryo her zaman geçerli değildir. İki farklı referans farklı bellek konumlarını gösterebilir, ama referansların gösterdiği nesneler yine de eşit olabilir.

---

Günlük hayatta bazen nicelikler karşılaştırılır. Örneğin sizin iki elmanız varsa ve arkadaşınızın da iki elması varsa, sizin ve arkadaşınızın elma sayısı eşittir.

Öte yandan bazen şeyler özellikleri ya da yapıları açısından da karşılaştırılabilir. Bu senaryonun ayrıntılarına girelim.

---

### Yapısal Eşitlik

Yapısal eşitlik, nesnelerin özelliklerinin durumlarına göre karşılaştırıldığı eşitlik türüdür. Bu tür eşitliği kontrol etmek için yalnızca “==” operatöründen daha gelişmiş bir araç gerekir. Bu araç equals() metodudur. Java programlama dilinde sınıf hiyerarşisinin en tepesindeki Object sınıfından gelir. Aşağıdaki Java kod parçasına bakalım;

```java
public class Car {

    // Assume that we have corresponding constructor, accessors, mutators, etc.

    private String brand;
    private String model;
    private Integer modelYear;
    private Integer mileage;
    
}
```

Markaları, modelleri ve model yılları aynıysa iki arabanın eşit olduğunu varsayalım. Burada bir varsayımımız var, çünkü gerçek durum her zaman budur. Bu tür eşitlik nicelikle değil, kimlikle ilgilidir. Dolayısıyla kimlik için bir tanım oluşturuyoruz. Aynı iki kimliğimiz varsa, bunların özdeş ya da eşit olduğunu söyleyebiliriz. Aşağıdaki kod parçasıyla devam edelim;

```java
Car car1 = new Car("Audi","R8", 2023);
Car car2 = new Car("Audi","R8", 2023);
Car car3 = new Car("Audi","R8", 2021);

System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
```

Çıktıda ne görmeyi bekliyorsunuz? İlk satırda true, ikinci satırda false göreceğinizi düşünüyorsanız yanılıyorsunuz. Car sınıfının equals metodu henüz uygulanmadığı için Object sınıfındaki ***equals()*** metoduna bakalım. Böylece Object sınıfının [***equals()***](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Object.html#equals%28java.lang.Object%29) metoduna varıyoruz;

```java
public boolean equals(Object obj) {
    return (this == obj);
}
```

Burada yalnızca referans eşitliği kontrol ediliyor ve bu tamamen beklenen bir şey, çünkü farklı sınıflar için farklı kimlikler olmalıdır. Object sınıfı, Java'daki bütün nesnelerin hiyerarşisinin en tepe noktasını temsil eder. Java'daki bütün nesne türlerinin ortak noktası referanslarıdır. Bu yüzden Object sınıfının ***equals()*** metodunda yalnızca referans eşitliğinin kontrol edilmesi tamamen normaldir. Bir alt sınıfın kimliğini belirlemek için ona bir kimlik oluşturmalıyız. Başka bir deyişle Object sınıfındaki equals() metodunu override etmeli ve sınıfın iki nesnesinin nasıl eşit olabileceğini belirlemeliyiz. equals() metodunu override ederek Car sınıfını genişletelim;

```java
public class Car {

    private String brand;
    private String model;
    private Integer modelYear;
    private Integer mileage;

    // Assume that we have corresponding constructor, accessors, mutators, etc.

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Car car = (Car) o; 
        return brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear);
    }
    
}
```

Metodun ilk satırında referans eşitliği kontrol edilir. İki farklı nesne referansı aynı nesneyi gösteriyorsa eşittirler. Durum böyle değilse, başka bir deyişle aynı nesneyi göstermeyen iki farklı referansımız varsa, bu iki nesnenin kimliğini kontrol etmeye başlamanın zamanı gelmiştir.

İkinci satırda nesnelerin kimliğini kontrol etmeye başlıyoruz. *o* nesne referansı null ise ya da iki nesne referansı farklı sınıflara ait nesneleri gösteriyorsa, bu iki nesnenin aynı kimliğe sahip olmadığı ve eşit olmadığı doğrudan söylenebilir. Durum böyle değilse, sonunda nesnelerin gerçek yapılarını kontrol edebiliriz.

Metodun üçüncü satırında, metot Object sınıfından override edildiği ve artık Car sınıfına ait olduğunu bildiğimiz için *o* referansını ilgili sınıf tipine dönüştürüyoruz (cast).

Son olarak metodun son satırında iki nesnenin yapısı kontrol edilir ve kimliğin tanımlandığı asıl satır budur. Basitçe, markalar, modeller ve model yılları aynıysa bu iki nesne eşittir. Başka bir deyişle bu, yapısal eşitliktir.

---

Matematiksel eşitliğin özelliklerini ilkokulda öğrendik. Bu özelliklerin bazıları ***equals()*** metodu için de geçerli olmak zorundadır. Bu, bu özelliklerin ***equals()*** metodunun bileşenlerine eklenmesi gerektiği anlamına gelir. Bu özellikleri matematiksel eşitlik açısından ve Java'daki eşitlik açısından görelim;

### Yansıma Özelliği

Yansıma özelliğinin (reflexive property) matematiksel tanımında, bütün **x** gerçek sayıları için;

> **x = x**

Bir sayı kendisine eşittir.

Java eşitliği açısından bir nesne kendisine eşit olmak zorundadır;

```java
Car car1 = new Car("Audi","R8",2013);
System.out.println(car1.equals(car1));
```

***equals()*** metodunun, kazara ya da bilerek, aşağıdaki kod parçasındaki gibi yazıldığını varsayalım;

```java
@Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Car car = (Car) o; 
        return mileage < car.mileage && brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear);
    }
```

***equals()*** metodunun bu uygulaması yansıma özelliğini açıkça ihlal eder. Nesnenin kilometresi kendisinden küçük olamaz.

### Simetri Özelliği

Simetri özelliğinin (symmetric property) matematiksel tanımı açısından, bütün **x** ve **y** gerçek sayıları için;

> **x =** **y** ise **y =** **x**

Eşitliğin sırası önemli değildir.

Java eşitliği açısından, a nesnesi b nesnesine eşitse b nesnesi de a nesnesine eşit olmak zorundadır;

```java
Car car1 = new Car("Audi","R8",2013);
Car car2 = new Car("Audi","R8",2013);
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car1));
```

Yukarıdaki kod parçası için art arda iki true görmeliyiz, çünkü ***equals()*** metodu simetri özelliğine uymak zorundadır. Her şeye rağmen ***equals()*** metodunu aşağıdaki kod parçalarındaki gibi uyguladığımızı varsayalım;

```java
public class Car {

    private String brand;
    private String model;
    private Integer modelYear;
    private Integer mileage;

    @Override
    public boolean equals(Object o) {
        if (o == this) return true;
        if (!(o instanceof Car)) return false;
        Car car = (Car) o;
        return brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear);
    }
}
```

Ve Car sınıfından kalıtım alan başka bir sınıfımız var;

```java
public class SportCar extends Car {
    
    private String engineType;

    @Override
    public boolean equals(Object o) {
        if (o == this) return true;
        if (!(o instanceof SportCar)) return false;
        SportCar sportCar = (SportCar) o;
        return engineType.equals(sportCar.engineType);
    }
}
```

Bu sınıflarla aşağıdaki kod parçasına sahip olduğumuzu varsayalım;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
SportCar car2 = new SportCar("Audi", "R8", 2012, 1000, "4.0");
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car1));
```

Çıktının ilk satırı true olacak; yani car1 aslında car2'ye eşit. Simetri özelliğine göre ikinci çıktının da true olması gerekir, ama ***equals()*** metotlarının yanlış uygulanması nedeniyle false olur. Bu, simetri özelliğini ihlal eden örneklerden biridir. Ayrıca ***equals()*** metodu uygulamalarında ***kalıtım kullanmaktan kaçınmak*** daha iyidir, çünkü bu özelliğe uyan doğru bir uygulama bulmak çok zordur.

### Geçişme Özelliği

Geçişme özelliğinin (transitive property) matematiksel tanımında, bütün **x**, **y** ve **z** gerçek sayıları için;

> **x = y** ve **y = z** ise **x = z**

Aynı sayıya eşit olan iki sayı birbirine eşittir.

> İhtiyaç geçişli değildir; insan, kendisine ihtiyaç duyulmadan ihtiyaç duyabilir.
>
> — Amitav Ghosh

Java eşitliği açısından, a nesnesi b nesnesine ve b nesnesi c nesnesine eşitse a nesnesi c nesnesine eşit olmak zorundadır;

```java
SportCar car1 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("100RPM"));
Car car2 = new Car("Audi", "R8", 2012, 1000);
SportCar car3 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("101RPM"));
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
System.out.println(car1.equals(car3));
```

Yukarıdaki kod parçası için art arda üç true görmeliyiz, çünkü ***equals()*** metodu geçişme özelliğine uymak zorundadır. Bir şeylerin gerçekten ters gittiğini ve SportCar sınıfı için aşağıdaki ***equals()*** metodunu uyguladığımızı varsayalım;

```java
public class SportCar extends Car {
    
    private Turbo turbo;

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Car)) return false;
        if (!(o instanceof SportCar)) return o.equals(this);
        return super.equals(o) && ((SportCar) o).turbo == turbo;
    }
}
```

Ayrıca ek bir Turbo sınıfımız var;

```java
public class Turbo {
    private String power;

    public Turbo(String power) {
        this.power = power;
    }
}
```

Şimdi aşağıdaki kod parçasına dönelim;

```java
SportCar car1 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("100RPM"));
Car car2 = new Car("Audi", "R8", 2012, 1000);
SportCar car3 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("101RPM"));
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
System.out.println(car1.equals(car3));
```

Çalışmanın sonunda ilk satırda true göreceğiz, çünkü SportCar sınıfının ***equals()*** uygulamasına göre car1, car2'ye eşittir. İkinci satırda da çıktı olarak true göreceğiz, çünkü car2 de car3'e eşittir. Ancak son satırda çıktı olarak false göreceğiz. Çünkü turbo güçleri farklıdır ve SportCar'ın ***equals()*** metodu uygulamasında bu da hesaba katılmıştır. Yine görüldüğü gibi, sınıfların eşitlik mekanizmalarında ***kalıtım uygulamalarından kaçınmak*** iyi bir uygulamadır. Farklı sınıflara ait iki nesne arasında bir kalıtım ilişkisi olsa bile, eşitlik tanımı açısından onları tamamen farklı nesneler olarak ele alın.

### Tutarlılık Özelliği

Matematikte tam bir karşılığı olmadığı için bu farklı bir özelliktir. Bunun için equals() metodunun art arda çalıştırılmalarında aynı sonucu almamız gerekir.

> Tutarlılık, ustalığın DNA'sıdır.
>
> — Robin S. Sharma

Aşağıdaki kod parçasına bakalım;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
Car car2 = new Car("Audi", "R8", 2012, 1000);

for (int i = 0; i < 100000; i++) {
    System.out.println(car1.equals(car2));
}
```

Çıktıda yalnızca true'lar ya da false görmeyi bekleriz. Eşitliğin hesaplanmasında rastgele bir tamsayının kullanıldığı bir senaryo olduğunu varsayalım. Aşağıdaki kod parçasına bakın;

```java
@Override
public boolean equals(Object o) {
    if (o == this) return true;
    if (!(o instanceof Car)) return false;
    Car car = (Car) o;
    Random random = new Random();
    return brand.equals(car.brand) && model.equals(car.model) && (random.nextInt(10) + 2013) == car.modelYear;
}
```

Bu koşullar altında birden fazla çağrıdan tutarlı sonuçlar vermesini bekleyemeyiz. Dolayısıyla equals() metodunda herhangi bir rastgele değer mekanizması kullanmaktan kaçınmak iyi bir uygulamadır.

**Not:** Bu örnek beni pek tatmin etmiyor. Kapsamlı bir araştırmadan sonra onu daha iyisiyle değiştireceğim. equals() metodunun Java belgelerinde açıkça *“`x.equals(y)`'nin birden fazla çağrısı tutarlı biçimde `true` ya da tutarlı biçimde `false` döndürür”* deniyor. Bu ifadenin ihlaline dair sağlam bir örnek olmalı.

### Null Parametre Özelliği

Bu özelliğe ben böyle demeyi seçiyorum.

Lütfen aşağıdaki kod parçasına bakın;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
Car car2 = null;
System.out.println(car1.equals(car2));
```

Parametre null olduğunda ***equals()*** metodunun sonuç olarak her zaman false döndürmesini bekleriz; dolayısıyla bu özelliği equals metodunun her olası uygulamasında uygulamak iyi bir fikirdir.

---

Artık bir equals() metodu uygulamasının, eşitliğin doğru hesaplanmasını sağlamak için hangi özelliklere sahip olması gerektiği açık. Ayrıca olası ihlal senaryolarını da gördük; böylece artık kod kalitesi ve iş mantığı uğruna onlardan kaçınabiliriz.

Bugün pek çok IDE, mümkün olan en iyi ***equals()*** metodu uygulamalarını üretmek için üretim mekanizmaları sunuyor. Çoğu zaman ***equals()*** metodunu kendiniz uygulamak yerine bunlara bağlı kalmak iyi bir fikirdir. [Intellij IDEA](https://www.jetbrains.com/idea/)'dan bir örnek görelim;

```java
  @Override
   public boolean equals(Object o) {
       if (this == o) return true;
       if (o == null || getClass() != o.getClass()) return false;
       Car car = (Car) o;
       return brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear) && mileage.equals(car.mileage);
   }
```

Car sınıfının bütün özelliklerinin null olmadığını varsayalım.

İlk satırda referans eşitliği kontrol edilir, çünkü iki nesne referansı aynı nesneyi gösteriyor olabilir.

İkinci satırda ***Null Parametre Özelliği***nin geçerliliği sağlanır; aynı if koşulu, ***Geçişme Özelliği*** ve ***Simetri Özelliği***nin ihlal edilmesini önlemek için referansların gösterdiği nesnelerin sınıf tipini kontrol ederek bir ***koruyucu if cümlesi*** (guard if clause) işlevi de görür.

Üçüncü satırda, Car nesnesinin özelliklerine erişmek için nesne referansı ilgili sınıf tipine, örneğimizde Car'a dönüştürülür (cast).

Son olarak dördüncü satırda eşitlik, yapısal eşitlik açısından kontrol edilir.

***equals()*** metodu üretimi için başka şablonlar da var. Onlara da gidip bakabilirsiniz.

Uygulamayı kendiniz yazmak isterseniz, lütfen uygulamanın bütün ***equals()*** metodu özelliklerinin geçerliliğini sağlaması gerektiğini aklınızda tutun.

---

Yazının sonuna gelirken, hâlâ kapatılması gereken çok önemli bir boşluk var. IDE'nizi açın ve ***equals()*** metodu üretmeyi deneyin. ***hashCode()*** metodu olmadan yalnızca ***equals()*** metodunu üretme seçeneği olmadığını göreceksiniz. Java programlama dilindeki bazı koleksiyon türleri nedeniyle bu iki metodu birbirinden ayırmamak çok iyi bir uygulamadır. Resmî Java belgelerinde de ***equals()*** metodu override edildiğinde ***hashCode()*** metodunun da override edilmesinin genellikle gerekli olduğu söylenir. Hashing ve ***hashCode()*** metodu hakkındaki ilgili bilgileri başka bir yazımda vermek istiyorum.

Ayrıca JPA'nın entity sınıfları gibi bazı istisnai durumlarda ***equals()*** metodu özelliklerine bağlı kalmamamız gerekebilir. Bu da kendi yazısını hak ediyor.

### Sonuç Olarak

Doğru ***equals()*** metodunu uygulamak için bütün önemli noktalar bu yazıda ele alındı. ***equals()*** metodu özelliklerinin geçerliliğini test etmek için ilgili birim testlerini yazmanızı da öneririm. Web'de bulunabilecek diğer kaynaklara bakmayı unutmayın.

İlk bakışta, nesne yönelimli tasarımın temellerinden olduğu için çok kolay ve basit bir konu gibi görünüyor. Ancak ayrıntılardan da görüldüğü gibi, bu temel kavramları atlamamak ve tam olarak anlamak çok önemlidir.
