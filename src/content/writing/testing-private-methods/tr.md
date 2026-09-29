---
title: "Private Metotları Test Etmek!"
description: "Private metotlar. Test etmeli mi, etmemeli mi? İşte ciddi bir soru."
short: "Private Metotları Test Etmek!"
mediumUrl: https://medium.com/havelsan/testing-private-methods-afbda842d44a
---

![Laboratuvar önlüklü bir bilim insanının, çevresinde cam laboratuvar kapları ve kontrol listeleriyle bir dizüstü bilgisayarda kod test ettiği çizim.](./bugfender-illustration.jpeg)

*Görsel: Marc Moreno, [BugFender](https://bugfender.com/blog/how-to-write-unit-tests-for-kotlin/).*

Nesne yönelimli tasarımda nesneler doğal olarak birbiriyle etkileşir; bu da onları gerçekten birbirinin istemcisi yapar. Aslında, bunun hemen ardından, bir nesnenin en ilk istemcileri [birim testleridir](https://en.wikipedia.org/wiki/Unit_testing) (unit tests).

Nesnenin bütün ***public*** işlevleri, üretim ortamındaki gerçek bir istemcinin bu işlevleri kendi işi için kullanması gibi, birim testleri tarafından test amacıyla kullanılır. Olması gerektiği gibi, iç işlevler istemcilere sunulmayabilir, çünkü onlarla ilgisizdirler. Dolayısıyla bu bakış açısına göre private metotlar ***ilkel düzeyde basit olmalı*** ya da ***test edilmeye ihtiyaç duymamalıdır***.

Geliştiriciler private metotları test ettiğinde, genellikle günü karmaşık, gereksiz ve basmakalıp (boilerplate) kodla bitirirler. Bu, birim testinin yalnızca işlevi test etmenin bir yolu değil, aynı zamanda olası tasarım kusurlarını görmek için ***bir araç*** olduğunun işaretidir. Bu cümlenin ayrıntılarına ***çok basit*** bir örnekle girelim, ama önce yazılım mühendisliğinin çok temel bir kavramına bakmamız gerekiyor.

## Tek Sorumluluk İlkesi (Single Responsibility Principle, SRP)

Kısacası, adından da anlaşıldığı gibi, tek sorumluluk ilkesi, programın her parçasının ***yalnızca bir işten*** sorumlu olması gerektiğini söyleyen bir programlama ilkesidir. Başka bir deyişle, her parça yalnızca yapması gereken şeyle ilgili işlevi sunmalıdır. Bu parçalar bir sınıf, bir modül ya da programın kendisi olabilir. Bu sefer bir sınıfla devam edeceğiz. Bu ilke hakkında ayrıntılı bilgi için [şuna](https://en.wikipedia.org/wiki/Single-responsibility_principle) göz atabilirsiniz.

## Hadi Elimizi Kirletelim

Şaşırtıcı bir şekilde (şaşırtıcı diyorum, çünkü bunu öğrendiğimde “vay, bu harika” demiştim), bir sınıfın işlevinin doğru uygulandığından ya da kapsamanın (coverage) yeterince iyi olduğundan emin olmak için o sınıfın private metotlarını test etmeniz gereken bir durumda bulursanız kendinizi, ***büyük olasılıkla*** ***SRP***'yi ihlal etmişsinizdir.

Böyle bir senaryo için örnek bir sınıf olan aşağıdaki ***Java*** kod parçasına bakalım;

```java
public class Student {

    private long id;
    private String name;
    private String surname;
    private int grade;

    /*
     * Let's assume that the constructor and accessor-mutator methods were already implemented.
     */

    public String takeExam(String lectureName) {
        StringBuilder builder = new StringBuilder();
        builder.append("I passed the " + lectureName + " exam successfully! My ID card is here!");
        builder.append(createIdCard(id, name, surname, grade));
        return builder.toString();
    }

    private String createIdCard(long id, String name, String surname, int grade) {
        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.append("-".repeat(100));
        stringBuilder.append("\nStudent ID: ");
        stringBuilder.append(id);
        stringBuilder.append("\nName: ");
        stringBuilder.append(name);
        stringBuilder.append("\nSurname: ");
        stringBuilder.append(surname);
        stringBuilder.append("\nGrade: ");
        stringBuilder.append(grade);
        stringBuilder.append("\n");
        stringBuilder.append("-".repeat(100));
        return stringBuilder.toString();
    }
}
```

Burada birkaç özniteliği ve biri public, diğeri private erişim belirleyicisine sahip iki farklı metodu olan basit bir Student sınıfı görüyoruz. Normalde sınava girmek, öğrenci sınıfının bir davranışıdır. Ancak normal bir durumda öğrencilerin kendi öğrenci kimlik kartlarını hazırlayıp oluşturmaları beklenmez.

Bu senaryoda ***takeExam()*** metodu, işlevini tam olarak yerine getirebilmek için başka bir metoda bağımlıdır. Öte yandan ***createIdCard()*** metodu başka bir işlev uğruna bir iç işlev sunmaktadır ve private metot olarak tanımlandığı için sınıfın dışından, ***birim testleri de dahil***, erişilemez. Ayrıca sınıfın diğer kısımlarına göre ***görece*** karmaşık bir mantığı olduğu için, fonksiyonun içinde her şeyin düzgün çalıştığından emin olmamak geliştirmenin sonraki aşamalarında, hatta üretim aşamasında başınızı gerçekten çok ağrıtabilir.

Peki bu sorunu çözmek için hangi seçeneklerimiz var? Birkaç yaklaşım olabilir.

## Olası Yaklaşımlar

### Private Metotları Test Etmek (YAPMAYIN)

Bu private metodu test etmekle başlayalım; bu, ***en kötüsü*** olabilir. Bunu programlama dilinin bazı temel özelliklerini kullanarak yapmanın yolları vardır. Örneğin C#'ta, test içinde private bir özelliği ya da metodu çağırma olanağı veren [PrivateObject](https://docs.microsoft.com/en-us/previous-versions/visualstudio/visual-studio-2013/ms245564%28v=vs.120%29) vardır. Java'da da aynı işlevi sağlayan [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html) vardır; [Manifold Compiler Plugin](http://manifold.systems/) tarafından sağlanan [Jailbreak](https://github.com/manifold-systems/manifold/blob/master/manifold-deps-parent/manifold-ext/README.md#type-safe-reflection-via-jailbreak) anotasyonu da [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html) kullanır. Ancak bu yaklaşımı seçmek hem geliştirme süresi hem de çalışma süresi açısından zaman alıcı olacak ve ***gereksiz karmaşıklık*** yaratacaktır. Birim testlerinin temel ilkelerinden biri olan ***hızlı çalışabilme*** ilkesine göre bu yaklaşım o ilkeyi ihlal eder, çünkü [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html) ve benzeri kütüphaneler işlem süresine gerçekten çok açtır. Ayrıca normalde üretimde bir istemci olarak kullanamayacağınız bir fonksiyonu test edersiniz. Bu da anlamsız bir durum yaratır. Bu, bir cep telefonu satın alıp süper mikroişlemcisinin integral gibi karmaşık matematiksel hesaplamaları yapıp yapamadığını, telefonu söküp özel bir test cihazına bağlayarak özellikle kontrol etmeye benzer. Normal bir müşteri olarak bu zaman alıcı ve zordur, değil mi? En önemlisi, basit bir satın alma işlemi için gereksiz bir karmaşıklık yaratır. Bu işlevlerin testi bir cep telefonu fabrikasında yapılmalıdır. Cep telefonunun test etmeniz gereken işlevleri, istemci tarafından kolayca ve normal yoldan erişilebilen işlevlerdir. Örneğin telefonu açıp kapatabildiğinizi, telefon görüşmesi yapabildiğinizi, ekranın üç renk gösterdiğini vb. test edersiniz. Dikkat edin. Burası biraz karışık. Cep telefonu fabrikasını da normalde sizin çalıştırmamanız gereken o testlerin başka bir istemcisi olarak düşünebiliriz.

### Private Metotları Olduğu Gibi Bırakmak (Önerilmez)

Mevcut iş mantığınızı ve bütün public metotlar için birim testlerini yazdığınızı, hepsinin de geçtiğini varsayalım. Ancak iş mantığınıza ait bazı kısımlar hâlâ doğrudan değil, public metotlarınız üzerinden test edilmiş durumda. Kodunuzu geliştirmeye devam ettiniz ve bazı yeni özellikler eklediniz. Bir süre sonra private metotlarınıza bir miktar mantık eklemeniz ya da imzalarını değiştirmeniz gerekti, çünkü onlar başka mantıksal kısımlarda da kullanılıyor. Sonra test takımında (test suite) bazı kırmızı çarpılar görüyorsunuz; bu, bazı mantıkları bozduğunuz anlamına geliyor. Şimdi ilgili testlerinizi mantığa uyarlamak için yeniden yazmanız gerekiyor. Bu hem daha fazla zaman ister hem de testlerinize ve kod tasarımınıza güvenin eksik olduğunu gösterir. Bu, zaten tasarlanmış ve uygulanmış kod kısımlarınızı yeniden yazmanız gerektiği zamanki durumla aynıdır ve kötü tasarlanmış bir yapının işaretidir. Çoğu zaman bu tür senaryolarla uğraşmak gitgide daha fazla yeniden düzenleme (refactoring) ve tabii ki daha fazla zaman gerektirir. Öte yandan profesyonel hayatta kaçınılmaz olarak başka geliştiricilerle çalışmanız ya da işinizi değiştirmeniz gereken bir noktaya gelebilirsiniz. Bu yeni gelen zavallı geliştirici de aynı durumla karşılaşabilir ve bazı özellikler vb. eklemesi gerekebilir. O zaman durumun üstesinden gelmek onun için daha zor olur, çünkü kodu yazan kişi o değildir ve bu yine yalnızca daha fazla zamana mal olacaktır. Görüldüğü gibi bu, çoğunlukla projeye ayrılan zaman miktarıyla ilgilidir.

### Yeni Parçalar Çıkarmak (Bunu Yapın!)

Bu yazının başında belirtildiği gibi, private metotlarınızı test etme ihtiyacı duyduğunuzda büyük olasılıkla SRP'yi ihlal ediyorsunuzdur. Başka bir deyişle sınıfınız çok fazla iş yapıyordur. Şimdi mevcut sınıf yapınızı yeniden düzenlemeyi ve oradan bazı yeni sınıflar çıkarmayı düşünmek için iyi bir zaman olabilir. Önceki ***çok basit*** kod parçasını iki farklı parçaya ayıralım;

```java
public class Student {

    private long id;
    private String name;
    private String surname;
    private int grade;
    private StudentCardCreator cardCreator;

    /*
     * Let's assume that the constructor and accessor-mutator methods were already implemented.
     */

    public String takeExam(String lectureName) {
        StringBuilder builder = new StringBuilder();
        builder.append("I passed the " + lectureName + " exam successfully! My ID card is here!");
        builder.append(cardCreator.createIdCard(id, name, surname, grade));
        return builder.toString();
    }
}
```

```java
public class StudentCardCreator {

    public String createIdCard(long id, String name, String surname, int grade) {
        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.append("-".repeat(100));
        stringBuilder.append("\nStudent ID: ");
        stringBuilder.append(id);
        stringBuilder.append("\nName: ");
        stringBuilder.append(name);
        stringBuilder.append("\nSurname: ");
        stringBuilder.append(surname);
        stringBuilder.append("\nGrade: ");
        stringBuilder.append(grade);
        stringBuilder.append("\n");
        stringBuilder.append("-".repeat(100));
        return stringBuilder.toString();
    }
}
```

Gördüğümüz gibi öğrenci kartlarının oluşturulması öğrencilerin sorumluluğu değildir. Yeniden düzenleyip yeni bir sınıf çıkardıktan sonra artık her sınıftaki bileşenleri [***taklit ederek***](https://en.wikipedia.org/wiki/Mock_object) (mocking) her işlevi ayrı ayrı test edebilir ve SRP'yi de sağlayabiliriz. [Mockito](https://site.mockito.org/) adında bir çatı (framework) var ama o kendi yazısını hak ediyor. Bu yaklaşım ileride oluşabilecek hataların ya da istenmeyen tasarım kusurlarının olasılığını azaltacaktır.

## Sonuç Olarak

Bu sorunun üstesinden gelmek için birkaç yaklaşım sunmuş olsam da bu duruma yönelik başka çözümler ya da karşı görüşler de vardır. Kişisel olarak ben çoğunlukla son seçeneğe bağlı kalıyorum.

Görüldüğü gibi birim testi yalnızca işlevi test etmenin bir yolu değil, aynı zamanda tasarımınızın ne kadar sağlam olduğunun da bir göstergesidir.
