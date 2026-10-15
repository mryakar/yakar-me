---
title: "Cómo escribir equals() en Java"
description: "Un artículo para entender la importancia del método equals() en Java. Ofrece los detalles de su implementación a nivel de maestría."
short: "Cómo escribir equals()"
mediumUrl: https://medium.com/havelsan/how-to-write-equals-in-java-5e9a908045a1
---

Al final de este artículo se habrá cubierto toda la información necesaria para poder escribir el mejor método equals() en el lenguaje de programación Java. Los detalles de la igualdad se tratarán desde la definición matemática y a la manera del lenguaje Java, para cubrir la información fundamental que se necesita para aplicar las buenas prácticas del método ***equals()***.

---

## Definición matemática de la igualdad

Según [Wikipedia](https://en.wikipedia.org/wiki/Equality_%28mathematics%29#:~:text=In%20mathematics%2C%20equality%20is%20a,and%20pronounced%20A%20equals%20B.), la definición de la igualdad matemática es

> En matemáticas, la igualdad es una relación entre dos cantidades o, más en general, entre dos expresiones matemáticas, que afirma que las cantidades tienen el mismo valor o que las expresiones representan el mismo objeto matemático. La igualdad entre *A* y *B* se escribe *A* = *B* y se lee *A* es igual a *B*.

## Definición de la igualdad en Java

En el lenguaje de programación Java, igualdad significa sencillamente tener el mismo valor. A veces se refiere literalmente a tener el mismo valor y a veces a tener la misma estructura en cuanto a las propiedades del objeto.

Cuando hace falta comprobar la igualdad de dos valores de tipo primitivo, se usa directamente el signo igual, como en el ejemplo siguiente;

```java
int a = 5;
int b = 6;
int c = 5;

// Prints "false" since a and b do not have the same value.
System.out.println(a == b);

// Prints "true" since a and c have the same value.
System.out.println(a == c);
```

En este fragmento de código se usa el tipo primitivo entero. Sin embargo, lo mismo vale para los demás tipos primitivos.

---

Por otro lado, a veces hace falta comprobar la igualdad de dos objetos. En el caso de los objetos, hay dos enfoques distintos que se usan en diferentes etapas del proceso de comprobar la igualdad de dos objetos. Entremos en los detalles.

### Igualdad referencial

En el lenguaje de programación Java, los valores reales de los objetos se almacenan en algún lugar de la memoria y a ellos apuntan las referencias de objeto, que también se almacenan en algún lugar de la memoria. Veamos el siguiente fragmento de código;

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

En el lenguaje de programación Java, el operador “new” crea un objeto y devuelve una referencia que apunta a la ubicación real del objeto en memoria. En tiempo de ejecución pueden crearse muchas referencias de objeto que apunten al mismo objeto. En cuanto a la igualdad referencial, se comprueba si dos referencias de objeto apuntan o no a la misma ubicación de memoria.

En un escenario así, “a” y “b” son en realidad dos referencias que apuntan al mismo objeto, de modo que puede decirse directamente que “a” es igual a “b”, puesto que se da la igualdad referencial.

Sin embargo, el escenario contrario no siempre es válido. Dos referencias distintas pueden apuntar a ubicaciones de memoria distintas, y aun así los objetos a los que apuntan pueden ser iguales.

---

En la vida corriente, a veces se comparan cantidades. Por ejemplo, si tú tienes dos manzanas y tu amigo tiene dos manzanas, el número de manzanas que tenéis tú y tu amigo es igual.

Por otro lado, a veces las cosas también pueden compararse por sus propiedades o su estructura. Entremos en los detalles de este escenario.

---

### Igualdad estructural

La igualdad estructural es el tipo de igualdad en el que los objetos se comparan según el estado de sus propiedades. Para comprobar este tipo de igualdad hace falta una herramienta más sofisticada que el simple operador “==”. Es el método equals(). Procede de la clase Object, que está en el punto más alto de la jerarquía de clases del lenguaje Java. Veamos el siguiente fragmento de código Java;

```java
public class Car {

    // Assume that we have corresponding constructor, accessors, mutators, etc.

    private String brand;
    private String model;
    private Integer modelYear;
    private Integer mileage;
    
}
```

Supongamos que dos coches son iguales si sus marcas, modelos y años de modelo son iguales. Aquí partimos de una suposición, porque siempre es el caso real. Este tipo de igualdad no trata de la cantidad, sino de la identidad. Así que creamos una definición de identidad. Si tenemos dos identidades iguales, podemos decir que son idénticos o iguales. Sigamos con el siguiente fragmento de código;

```java
Car car1 = new Car("Audi","R8", 2023);
Car car2 = new Car("Audi","R8", 2023);
Car car3 = new Car("Audi","R8", 2021);

System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
```

¿Qué esperas ver en la salida? Si crees que verás true en la primera línea y false en la segunda, te equivocas. Veamos el método ***equals()*** de la clase Object, ya que el método equals de la clase Car todavía no se ha implementado. Así que acabamos en el método [***equals()***](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Object.html#equals%28java.lang.Object%29) de la clase Object;

```java
public boolean equals(Object obj) {
    return (this == obj);
}
```

Aquí solo se comprueba la igualdad referencial, lo cual es totalmente esperable, porque clases distintas deben tener identidades distintas. La clase Object representa el punto más alto de la jerarquía de todos los objetos de Java. Lo que tienen en común todos los tipos de objetos en Java son sus referencias. Por eso es totalmente normal que el método ***equals()*** de la clase Object compruebe solo la igualdad referencial. Para especificar la identidad de una clase hija, debemos crearle una identidad. Dicho de otro modo, debemos sobrescribir (override) el método equals() de la clase Object y determinar cómo pueden ser iguales dos objetos de la clase. Ampliemos la clase Car sobrescribiendo el método equals();

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

En la primera línea del método se comprueba la igualdad referencial. Si las dos referencias de objeto distintas apuntan al mismo objeto, son iguales. Si no es así, es decir, si tenemos dos referencias distintas que no apuntan al mismo objeto, es hora de empezar a comprobar la identidad de estos dos objetos.

En la segunda línea empezamos a comprobar la identidad de los objetos. Si la referencia de objeto *o* es null o si las dos referencias apuntan a objetos que pertenecen a clases distintas, puede decirse directamente que estos dos objetos no tienen la misma identidad y no son iguales. Si no es así, por fin podemos comprobar las estructuras reales de los objetos.

En la tercera línea del método, convertimos (cast) la referencia *o* al tipo de clase correspondiente, ya que el método se sobrescribe a partir de la clase Object y ahora sabemos que pertenece a la clase Car.

Por último, en la última línea del método se comprueba la estructura de los dos objetos, y esta es la línea en la que realmente se define la identidad. Sencillamente, si las marcas, los modelos y los años de modelo son iguales, estos dos objetos son iguales. Dicho de otro modo, esta es la igualdad estructural.

---

Las propiedades de la igualdad matemática las aprendimos en la escuela primaria. Algunas de ellas también tienen que cumplirse en el método ***equals()***. Esto significa que hay que añadirlas a los ingredientes del método ***equals()***. Veamos estas propiedades desde la igualdad matemática y desde la igualdad en Java;

### Propiedad reflexiva

En la definición matemática de la propiedad reflexiva, para todo número real **x**;

> **x = x**

Un número es igual a sí mismo.

En cuanto a la igualdad en Java, un objeto tiene que ser igual a sí mismo;

```java
Car car1 = new Car("Audi","R8",2013);
System.out.println(car1.equals(car1));
```

Supongamos que el método ***equals()*** se escribe, por accidente o a propósito, como en el siguiente fragmento de código;

```java
@Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Car car = (Car) o; 
        return mileage < car.mileage && brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear);
    }
```

Esta implementación del método ***equals()*** viola claramente la propiedad reflexiva. El kilometraje del objeto no puede ser menor que el suyo propio.

### Propiedad simétrica

En cuanto a la definición matemática de la propiedad simétrica, para todos los números reales **x** e **y**;

> Si **x =** **y**, entonces **y =** **x**

El orden de la igualdad no importa.

En cuanto a la igualdad en Java, si el objeto a es igual al objeto b, entonces el objeto b tiene que ser igual al objeto a;

```java
Car car1 = new Car("Audi","R8",2013);
Car car2 = new Car("Audi","R8",2013);
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car1));
```

Para el fragmento de código anterior, debemos ver dos true consecutivos, ya que el método ***equals()*** tiene que cumplir la propiedad simétrica. A pesar de todo, supongamos que hemos implementado el método ***equals()*** como en los siguientes fragmentos de código;

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

Y tenemos otra clase que extiende la clase Car;

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

Con estas clases, supongamos que tenemos el fragmento de código siguiente;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
SportCar car2 = new SportCar("Audi", "R8", 2012, 1000, "4.0");
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car1));
```

La primera línea de la salida será true, es decir, car1 es igual a car2. Según la propiedad simétrica, la segunda salida también debe ser true, pero es false debido a la implementación incorrecta de los métodos ***equals()***. Este es uno de los ejemplos que violan la propiedad simétrica. Además, es mejor ***evitar la herencia*** en las implementaciones del método ***equals()***, porque es muy difícil dar con una implementación correcta que cumpla esta propiedad.

### Propiedad transitiva

En la definición matemática de la propiedad transitiva, para todos los números reales **x**, **y** y **z**;

> si **x = y** e **y = z**, entonces **x = z**

Dos números iguales a un mismo número son iguales entre sí.

> La necesidad no es transitiva: uno puede necesitar sin que lo necesiten a él.
>
> — Amitav Ghosh

En cuanto a la igualdad en Java, si el objeto a es igual al objeto b y el objeto b es igual al objeto c, entonces el objeto a tiene que ser igual al objeto c;

```java
SportCar car1 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("100RPM"));
Car car2 = new Car("Audi", "R8", 2012, 1000);
SportCar car3 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("101RPM"));
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
System.out.println(car1.equals(car3));
```

Para el fragmento de código anterior, debemos ver tres true consecutivos, ya que el método ***equals()*** tiene que cumplir la propiedad transitiva. Supongamos que algo ha salido realmente mal y hemos implementado el siguiente método ***equals()*** para la clase SportCar;

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

Además tenemos una clase Turbo adicional;

```java
public class Turbo {
    private String power;

    public Turbo(String power) {
        this.power = power;
    }
}
```

Volvamos ahora al siguiente fragmento de código;

```java
SportCar car1 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("100RPM"));
Car car2 = new Car("Audi", "R8", 2012, 1000);
SportCar car3 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("101RPM"));
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
System.out.println(car1.equals(car3));
```

Al final de la ejecución, en la primera línea veremos true, ya que según la implementación de ***equals()*** de la clase SportCar, car1 es igual a car2. En la segunda línea también veremos true como salida, porque car2 también es igual a car3. Sin embargo, en la última línea veremos false como salida, ya que las potencias del turbo son distintas y en la implementación del método ***equals()*** de SportCar también entran en el cálculo. Como vemos una vez más, es una buena práctica ***evitar aplicar la herencia*** en los mecanismos de igualdad de las clases. Aunque haya una relación de herencia entre dos objetos de clases distintas, trátalos como objetos totalmente distintos en lo que respecta a la definición de igualdad.

### Propiedad de consistencia

Esta es una propiedad diferente, ya que no tiene un equivalente matemático exacto. Para esta necesitamos obtener el mismo resultado en ejecuciones consecutivas del método equals().

> La constancia es el ADN de la maestría.
>
> — Robin S. Sharma

Veamos el siguiente fragmento de código;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
Car car2 = new Car("Audi", "R8", 2012, 1000);

for (int i = 0; i < 100000; i++) {
    System.out.println(car1.equals(car2));
}
```

Esperamos ver en la salida solo true o solo false. Supongamos que hay un escenario en el que se usa un entero aleatorio en el cálculo de la igualdad. Mira el siguiente fragmento de código;

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

En estas circunstancias no podemos esperar que dé resultados consistentes en invocaciones múltiples. Así que es una buena práctica evitar cualquier mecanismo de valores aleatorios en el método equals().

**Nota:** Este ejemplo no me convence del todo. Tras una investigación exhaustiva, lo sustituiré por uno mejor. En la documentación de Java del método equals() se dice claramente que *“las invocaciones múltiples de* `x.equals(y)` *devuelven consistentemente* `true` *o devuelven consistentemente* `false`*”*. Debe de haber un ejemplo sólido de violación de esta afirmación.

### Propiedad del parámetro nulo

Así es como he decidido llamar a esta propiedad.

Mira el siguiente fragmento de código;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
Car car2 = null;
System.out.println(car1.equals(car2));
```

Siempre esperamos que el método ***equals()*** devuelva false como resultado cuando el parámetro es null, así que es buena idea aplicar esta propiedad en toda implementación posible del método equals.

---

Ahora está claro qué propiedades debe tener una implementación del método equals() para calcular correctamente la igualdad. Además, hemos visto los posibles escenarios de violación, así que ahora podemos evitarlos en beneficio de la calidad del código y de la lógica de negocio.

Hoy en día muchos IDE ofrecen mecanismos para generar las mejores implementaciones posibles del método ***equals()***. Casi siempre es buena idea quedarse con ellas en lugar de implementar el método ***equals()*** a mano. Veamos un ejemplo de [Intellij IDEA](https://www.jetbrains.com/idea/);

```java
  @Override
   public boolean equals(Object o) {
       if (this == o) return true;
       if (o == null || getClass() != o.getClass()) return false;
       Car car = (Car) o;
       return brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear) && mileage.equals(car.mileage);
   }
```

Supongamos que ninguna propiedad de la clase Car es null.

En la primera línea se comprueba la igualdad referencial, porque dos referencias de objeto pueden apuntar al mismo objeto.

En la segunda línea se garantiza la validez de la ***propiedad del parámetro nulo***, y la misma condición if actúa además como ***cláusula de guarda***, controlando el tipo de clase de los objetos a los que apuntan las referencias para evitar que se violen la ***propiedad transitiva*** y la ***propiedad simétrica***.

En la tercera línea, la referencia de objeto se convierte al tipo de clase correspondiente, que en nuestro ejemplo es Car, para poder acceder a las propiedades del objeto Car.

Por último, en la cuarta línea se comprueba la igualdad en términos de igualdad estructural.

Hay otras plantillas para generar el método ***equals()***. También puedes ir a echarles un vistazo.

Si quieres escribir la implementación por tu cuenta, ten presente que debe garantizar la validez de todas las propiedades del método ***equals()***.

---

Al llegar al final del artículo, todavía queda un hueco muy importante por cubrir. Abre tu IDE e intenta generar el método ***equals()***. Verás que no hay ninguna opción para generar solo el método ***equals()*** sin el método ***hashCode()***. Debido a algunos tipos de colecciones del lenguaje Java, es muy buena práctica no separar estos dos métodos. La documentación oficial de Java también dice que, en general, es necesario sobrescribir el método ***hashCode()*** siempre que se sobrescribe el método ***equals()***. Me gustaría dar la información correspondiente sobre el hashing y el método ***hashCode()*** en otro artículo.

Además, a veces puede que no necesitemos atenernos a las propiedades del método ***equals()*** en algunos casos excepcionales, como las clases de entidad de JPA. Eso también merece su propio artículo.

### En conclusión

En este artículo se han cubierto todos los puntos importantes para implementar correctamente el método ***equals()***. También te recomiendo escribir las pruebas unitarias correspondientes para comprobar que se cumplen las propiedades del método ***equals()***. No olvides consultar otros recursos que se pueden encontrar en la web.

A primera vista parece un tema muy fácil y elemental, ya que pertenece a los fundamentos del diseño orientado a objetos. Sin embargo, como se ve por los detalles, es muy importante no saltarse estos conceptos básicos y entenderlos a fondo.
