---
title: "¡Probar métodos privados!"
description: "Métodos privados. ¿Probar o no probar? He ahí una pregunta seria."
short: "¡Probar métodos privados!"
mediumUrl: https://medium.com/havelsan/testing-private-methods-afbda842d44a
---

![Ilustración de un científico con bata de laboratorio probando código en un portátil, rodeado de material de vidrio y listas de comprobación.](./bugfender-illustration.jpeg)

*Imagen: Marc Moreno en [BugFender](https://bugfender.com/blog/how-to-write-unit-tests-for-kotlin/).*

En el diseño orientado a objetos, los objetos interactúan de forma natural entre sí, lo que los convierte, efectivamente, en clientes unos de otros. De hecho, justo después de esto, los primerísimos clientes de un objeto son las [pruebas unitarias](https://en.wikipedia.org/wiki/Unit_testing) (unit tests).

Todas las funcionalidades ***public*** del objeto las usan las pruebas unitarias con fines de prueba, igual que un cliente real en el entorno de producción usa esas funcionalidades para su propio negocio. Como es de esperar, las funcionalidades internas pueden no ofrecerse a los clientes, porque no les conciernen. Así que, desde este punto de vista, los métodos privados ***deben ser elementalmente simples*** o ***no deben necesitar*** que se los pruebe.

Cuando los desarrolladores prueban los métodos privados, normalmente terminan el día con código complejo, innecesario y repetitivo (boilerplate), lo que es una señal de que las pruebas unitarias no son solo la manera de probar la funcionalidad, sino también ***una herramienta*** para ver posibles defectos de diseño. Entremos en los detalles de esta frase con un ejemplo ***muy básico***, pero antes tenemos que repasar un concepto muy básico de la ingeniería del software.

## Principio de Responsabilidad Única (Single Responsibility Principle, SRP)

En pocas palabras, como indica su propio nombre, el principio de responsabilidad única es un principio de programación según el cual cada parte del programa debe ser responsable de ***una sola tarea***. Dicho de otro modo, cada parte debe ofrecer únicamente la funcionalidad relacionada con lo que se supone que hace. Estas partes pueden ser una clase, un módulo o el propio programa. Esta vez nos quedaremos con una clase. Para información detallada sobre este principio, puedes consultar [esto](https://en.wikipedia.org/wiki/Single-responsibility_principle).

## Manos a la obra

Asombrosamente (y digo asombrosamente porque cuando lo aprendí pensé «vaya, qué asombroso»), cuando te encuentras en una situación en la que necesitas probar los métodos privados de una clase para asegurarte de que su funcionalidad está bien implementada o de que la cobertura (coverage) es suficiente, ***lo más probable*** es que hayas violado el ***SRP***.

Veamos el siguiente fragmento de código ***Java***, una clase de ejemplo para un escenario así;

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

Aquí vemos una sencilla clase Student con un par de atributos y dos métodos distintos, uno con el modificador de acceso public y el otro private. Normalmente, hacer un examen es un comportamiento de la clase Student. Sin embargo, en una situación normal, no se espera que los estudiantes preparen y creen su propio carné de estudiante.

En este escenario, el método ***takeExam()*** depende de otro método para ofrecer su función por completo. Por otro lado, el método ***createIdCard()*** ofrece una funcionalidad interna al servicio de otra funcionalidad y, como está declarado como privado, no se puede alcanzar desde fuera de la clase, ***tampoco desde las pruebas unitarias***. Además, como tiene una lógica ***relativamente*** compleja en comparación con las demás partes de la clase, no asegurarte de que todo funciona correctamente dentro de la función puede darte verdaderos dolores de cabeza en las siguientes etapas del desarrollo o incluso en producción.

Entonces, ¿qué opciones tenemos para resolver este problema? Puede haber un par de enfoques.

## Enfoques posibles

### Probar los métodos privados (NO LO HAGAS)

Empecemos por probar este método privado, que quizá sea ***el peor***. Hay maneras de conseguirlo usando algunas características básicas del lenguaje de programación. Por ejemplo, en C# tenemos [PrivateObject](https://docs.microsoft.com/en-us/previous-versions/visualstudio/visual-studio-2013/ms245564%28v=vs.120%29), que te permite llamar a una propiedad o un método privados dentro de la prueba. También tenemos [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html) en Java, que ofrece la misma funcionalidad, o la anotación [Jailbreak](https://github.com/manifold-systems/manifold/blob/master/manifold-deps-parent/manifold-ext/README.md#type-safe-reflection-via-jailbreak) que proporciona el [Manifold Compiler Plugin](http://manifold.systems/), que también usa [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html). Sin embargo, elegir este enfoque va a costar tiempo, tanto de desarrollo como de ejecución, y crea ***complejidad innecesaria***. Según uno de los principios básicos de las pruebas unitarias, ***poder ejecutarse rápido***, este enfoque lo viola, porque [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html) y las bibliotecas similares consumen muchísimo tiempo de procesamiento. Además, pruebas una función que, como cliente, normalmente no puedes usar en producción. Eso también crea una situación sin sentido. Es como comprar un teléfono móvil y comprobar expresamente si su súper microprocesador puede hacer cálculos matemáticos complejos, como integrales, desmontándolo y conectándolo a un aparato de pruebas especial. Para un cliente normal es lento y difícil, ¿verdad? Y lo más importante: crea una complejidad superflua para un simple acto de compra. Esas funciones se prueban en una fábrica de teléfonos móviles. Las funciones del teléfono que debes probar son las que resultan accesibles de forma fácil y normal desde el lado del cliente. Por ejemplo, compruebas si puedes encenderlo y apagarlo, hacer una llamada, ver que la pantalla tiene tres colores, etc. Cuidado, aquí está la trampa. Podemos pensar que la fábrica de teléfonos móviles es también otro cliente para esas pruebas que normalmente tú no deberías ejecutar.

### Dejar los métodos privados como están (no recomendado)

Supongamos que has implementado tu lógica de negocio actual y las pruebas unitarias de todos los métodos públicos, y que todas pasan. Sin embargo, todavía quedan algunas partes de tu lógica de negocio que no se prueban directamente, sino a través de tus métodos públicos. Sigues desarrollando tu código y añades algunas funcionalidades nuevas. Al cabo de un tiempo necesitas añadir algo de lógica en tus métodos privados o cambiar su firma, porque también se usan en otras partes lógicas. Entonces ves unas cuantas cruces rojas en la batería de pruebas, lo que significa que has roto alguna lógica. Ahora tienes que reescribir las pruebas correspondientes para adaptarlas a la lógica, lo que requiere más tiempo y muestra falta de confianza en tus pruebas y también en el diseño de tu código. Es lo mismo que cuando necesitas reescribir partes de código ya diseñadas e implementadas, lo que es señal de una estructura mal diseñada. La mayoría de las veces, lidiar con escenarios así requiere cada vez más refactorización y, evidentemente, más tiempo. Por otro lado, en la vida profesional llegarás inevitablemente a un punto en el que tendrás que trabajar con otros desarrolladores o cambiar de trabajo. El pobre desarrollador recién llegado puede encontrarse con la misma situación y necesitar añadir algunas funcionalidades, etc. Entonces le resultará más difícil superar la situación, porque no es quien escribió el código, y esto, una vez más, solo va a costar más tiempo. Como se ve, se trata sobre todo de la cantidad de tiempo que se dedica al proyecto.

### Extraer partes nuevas (¡adelante!)

Como se dijo al principio de este artículo, cuando necesitas probar tus métodos privados, lo más probable es que estés violando el SRP. Dicho de otro modo, tu clase hace demasiado. Ahora puede ser un buen momento para pensar en refactorizar la estructura de clases existente y extraer de ella algunas clases nuevas. Refactoricemos el ***muy sencillo*** fragmento de código anterior en dos partes distintas;

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

Como vemos, crear carnés de estudiante no es responsabilidad de los estudiantes. Tras refactorizar y extraer una clase nueva, ahora podemos probar cada función por separado [***simulando***](https://en.wikipedia.org/wiki/Mock_object) (mocking) los componentes de cada clase, y además cumplir el SRP. Existe un framework llamado [Mockito](https://site.mockito.org/), pero merece su propio artículo. Este enfoque reducirá la probabilidad de futuros errores o de defectos de diseño no deseados.

## En conclusión

Aunque he presentado un par de enfoques para superar este problema, todavía hay otras soluciones posibles o argumentos en contra para esta situación. Personalmente, casi siempre me quedo con la última opción.

Como se ve, las pruebas unitarias no son solo una manera de probar la funcionalidad, sino también un indicador de lo sólido que es tu diseño.
