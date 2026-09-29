---
title: "How to Write equals() in Java"
description: "An article to understand the importance of equals() method in Java. It provides mastery details of implementation for it."
pubDate: 2023-02-22
topic: Java
short: "How to Write equals()"
mediumUrl: https://medium.com/havelsan/how-to-write-equals-in-java-5e9a908045a1
lang: en
---

By the end of this article, all required information is going to be covered to be able to write the best equals() method in Java programming language. The details of equality are going to be dealt with in terms of mathematical definition and in the manner of Java programming language in order to cover the fundamental information that is needed to use the best practice of ***equals()*** method.

---

## Mathematical Definition of Equality

According to [Wikipedia](https://en.wikipedia.org/wiki/Equality_%28mathematics%29#:~:text=In%20mathematics%2C%20equality%20is%20a,and%20pronounced%20A%20equals%20B.), the definition of mathematical equality is

> In mathematics, equality is a relationship between two quantities or, more generally two mathematical expressions, asserting that the quantities have the same value, or that the expressions represent the same mathematical object. The equality between *A* and *B* is written *A* = *B*, and pronounced *A* equals *B*.

## Definition of Equality in Java

In Java programming language, equality means simply having the same value. It is sometimes literally meant to have the same value and sometimes meant to have the same structure in terms of the properties of the object.

When it is needed to check the equality of two primitive type values, equals sign is directly used as in the example below;

```java
int a = 5;
int b = 6;
int c = 5;

// Prints "false" since a and b do not have the same value.
System.out.println(a == b);

// Prints "true" since a and c have the same value.
System.out.println(a == c);
```

In this code snippet, an integer primitive type is used. However, it is the same for other primitive types.

---

On the other hand, it is sometimes needed to check the equality of two objects. In terms of objects, there are two different approaches that are used in different stages of process of checking of the equality of two objects. Let’s get into the details.

### Referential Equality

In Java programming language, the objects’ actual values are stored somewhere in the memory and they are pointed by the object references which are also stored somewhere in the memory. Let’s look at the following code snippet;

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

In Java programming language, “new” operator creates an object and returns a reference which points the actual memory location of the object. Many object references which point to the same object may be created at runtime. In terms of referential equality, it is checked whether two object references are pointing to the same memory location or not.

In such a scenario, “a” and “b” are actually two references that are pointing to the same object, so it can be directly said that “a” is equal to “b” since the referential equality is obtained.

However, the opposite scenario is not valid all the time. Two different references may point different memory locations, but the objects that the references point may still be equal.

---

In normal life, sometimes quantities are compared. Like if you have two apples and your friend has two apples then the number of apples you and your friend has is equal.

On the other hand, sometimes things may also be compared in terms of its properties or structure. Let’s get into the details for this scenario.

---

### Structural Equality

Structural equality is the type of which the objects are compared according to states of their properties. A more sophisticated tool is needed to check this type of equality rather than only “==” operator. It is the equals() method. It comes from the Object class which is at the highest point of the class hierarchy in Java programming language. Let’s check the upcoming Java code snippet;

```java
public class Car {

    // Assume that we have corresponding constructor, accessors, mutators, etc.

    private String brand;
    private String model;
    private Integer modelYear;
    private Integer mileage;
    
}
```

Let’s assume that two cars are equal if their brands, models and model years are same. We have an assumption here, because it is always the actual case. This type of equality is not about the quantity but the identity. So we create a definition for identity. If we have two same identities, we can say they are identical or equal. Let’s continue with the up coming code snippet;

```java
Car car1 = new Car("Audi","R8", 2023);
Car car2 = new Car("Audi","R8", 2023);
Car car3 = new Car("Audi","R8", 2021);

System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
```

What do you expect to see in the output? If you think that you would see true for the first line and false in the second line then you are wrong. Let’s look at the ***equals()*** method in the Object class since the equals method of the Car class has not been implemented, yet. So we end up with the [***equals()***](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Object.html#equals%28java.lang.Object%29) method of Object class;

```java
public boolean equals(Object obj) {
    return (this == obj);
}
```

Only the referential equality is checked here which is totally expected, because there must be different identities for different classes. Object class represents the top point on the hierarchy of all objects in Java. The mutual point of all types of objects in Java is the references of them. That is why it is totally normal to check only the referential equality in the ***equals()*** method of the Object class. To specify the identity of a child class, we must create an identity for it. In other words we must override the equals() method in Object class and determine how two objects of the class can be equal. Let’s extend the Car class by overriding the equals() method;

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

On the first line of the method, the referential equality is checked. Since the two different object references point to the same object, they are equal. If this is not the case, in other words if we have two different references which do not point to the same object, it is time to start checking the identity of the these two objects.

On the second line we start to check the identity of the objects. If the object reference *o* is null or the both object references point to the objects which belong different classes, then it can be directly said that these two objects do not have the same identity and are not equal. If this is not the case then we are finally able to check the actual structures of the objects.

On the third line of the method, we cast the reference *o* to the corresponding class type since the method is overridden from Object class and now we know that it belongs to Car class.

Finally, on the last line of the method, the structure of two objects are checked and this is the actual line that the identity is defined. Simply, if brands models and model years are the same then these two objects are equal. On the other words, this is the structural equality.

---

We have learned the properties of mathematical equality at the elementary school. Some of these properties have to be valid for ***equals()*** method, too. It means that these properties have to be added to the ingredients of the ***equals()*** method. Let’s see these properties in terms of mathematical equality and in terms of equality in Java;

### Reflexive Property

In the mathematical definition of reflexive property, for all real numbers **x**;

> **x = x**

A number equals itself.

In terms of Java equality, an object has to equals itself;

```java
Car car1 = new Car("Audi","R8",2013);
System.out.println(car1.equals(car1));
```

Let’s assume that the ***equals()*** method is written accidentally or purposefully like in the up coming code snippet;

```java
@Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Car car = (Car) o; 
        return mileage < car.mileage && brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear);
    }
```

This implementation of ***equals()*** method violates the reflexive property apparently. Mileage of the object cannot be smaller than itself.

### Symmetric Property

In terms of mathematical definition of symmetric property, for all real numbers **x** and **y**;

> If **x =** **y** , then **y =** **x**

Order of equality does not matter.

In terms of Java equality, if object a equals object b, then object b has to equal object a;

```java
Car car1 = new Car("Audi","R8",2013);
Car car2 = new Car("Audi","R8",2013);
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car1));
```

For the above code snippet, we must see two consecutive trues since the ***equals()*** method has to follow the symmetric property. Despite all, let’s assume that we have implemented ***equals()*** method like in the up coming code snippets;

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

And we have another class extends to Car class;

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

With these classes, let’s suppose that we have the code snippet below;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
SportCar car2 = new SportCar("Audi", "R8", 2012, 1000, "4.0");
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car1));
```

The first line of output is going to be true that actually car1 is equal to car 2. According to symmetric property, the second output also must be true but it is false due to the incorrect implementation of ***equals()*** methods. This is one of the examples that violates the symmetric property. Also, it is better to ***avoid using inheritance*** in ***equals()*** method implementations since it is very hard to come up a correct implementation that follow this property.

### Transitive Property

In the mathematical definition of transitive property, for all real numbers **x**, **y**, and **z**;

> if **x = y** and **y = z**, then **x = z**

Two numbers equal to the same number are equal to each other.

> Need is not transitive, one may need without oneself being needed.
>
> — Amitav Ghosh

In terms of Java equality, if object a equals object b and object b equals object c, then object a has to be equal to object c;

```java
SportCar car1 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("100RPM"));
Car car2 = new Car("Audi", "R8", 2012, 1000);
SportCar car3 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("101RPM"));
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
System.out.println(car1.equals(car3));
```

For the above code snippet, we must see three consecutive trues since the ***equals()*** method has to follow the transitive property. Let’s assume that something really went wrong and we implemented below ***equals()*** method for SportCar class;

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

Also we have an additional Turbo class;

```java
public class Turbo {
    private String power;

    public Turbo(String power) {
        this.power = power;
    }
}
```

Now let’s return to below code snippet;

```java
SportCar car1 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("100RPM"));
Car car2 = new Car("Audi", "R8", 2012, 1000);
SportCar car3 = new SportCar("Audi", "R8", 2012, 1000, new Turbo("101RPM"));
System.out.println(car1.equals(car2));
System.out.println(car2.equals(car3));
System.out.println(car1.equals(car3));
```

At the end of the execution, on the first line we are going to see true since according to SportCar class ***equals()*** implementation car1 is equal to car2. On the second line we are also going to see true as output, because car2 is also equal to car3. However, on the last line we are going to see false as the output. Since the turbo powers are different and in the SportCar’s ***equals()*** method implementation it is also added to the calculation. As we see again, it is a good practice to ***avoid inheritance applications*** in equality mechanisms of classes. Even if there is an inheritance relation between two objects of different classes, treat them as totally different objects in terms of equality definition.

### Consistent Property

This is a different property since there is no exact equivalent mathematically. For this one we need to get the same result for consecutive executions of equals() method.

> Consistency is the DNA of mastery.
>
> — Robin S. Sharma

Let’s look the below code snippet;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
Car car2 = new Car("Audi", "R8", 2012, 1000);

for (int i = 0; i < 100000; i++) {
    System.out.println(car1.equals(car2));
}
```

We expect to see only trues or false in the output. Let’s suppose that there is a scenario that a random integer is used in the calculation of equality. Look at the below code snippet;

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

Under these circumstances we cannot expect it to give consistent results from multiple invocations. So it is a good practice to avoid using any random value mechanism in equals() method.

**Note:**This example does not really satisfy me. After an extensive research, I will replace it with a better one. It is clearly said in the Java documentation of equals() method that *“multiple invocations of*`x.equals(y)`*consistently return*`true`*or consistently return*`false`*”.* There must be a solid example of violation for this statement.

### Null Parameter Property

This is how I choose to call this property.

Please look at the below code snippet;

```java
Car car1 = new Car("Audi", "R8", 2012, 1000);
Car car2 = null;
System.out.println(car1.equals(car2));
```

We always expect ***equals()*** method to return false as the result when the parameter is null, so it is a good idea to apply this property in every possible implementation of equals method.

---

Now it is clear which properties an equals() method implementation should have in order to provide a correct calculation of the equality. Also, we have seen the possible violation scenarios, so we can now avoid them for the sake of the code quality and business logic.

Today many IDEs provide generation mechanisms to generate the best possible ***equals()*** method implementations. It is a good idea to stick with them most of the time instead of implementing the ***equals()*** method. Let’s see an example from [Intellij IDEA](https://www.jetbrains.com/idea/);

```java
  @Override
   public boolean equals(Object o) {
       if (this == o) return true;
       if (o == null || getClass() != o.getClass()) return false;
       Car car = (Car) o;
       return brand.equals(car.brand) && model.equals(car.model) && modelYear.equals(car.modelYear) && mileage.equals(car.mileage);
   }
```

Let’s assume that all properties of car class are not null.

On the first line, the referential equality is checked, because two object references may point to the same object.

On the second line, the validation of ***Null Parameter Property*** is ensured and also the same if condition acts as a ***guard if clause*** by controlling the class type of the objects that are pointed out by references in order to prevent violation of ***Transitive Property*** and ***Symmetric Property.***

On the third line, the object reference is cast into the corresponding class type which is Car in our example in order to reach the properties of the Car object.

Finally, on the fourth line the equality is checked in terms of the structural equality.

There are other templates for ***equals()*** method generation. You can also go and check them.

If you would like to write the implementation on your own, please keep in mind that the implementation must ensure validity for all ***equals()*** method property.

---

As we come to the end of the article, there is still a very important gap that needs to be covered. Open your IDE and try to generate ***equals()*** method. You are going to see that there is no option to only generate ***equals()*** method without ***hashCode()*** method. Due to the some collection types in Java programming language, it is a very good practice not to separate these two methods from each other. It is also said in the official Java documentation that it is generally necessary to override the ***hashCode()*** method whenever the ***equals()*** method is overridden. I would like to give corresponding information about hashing and ***hashCode()*** method in other article of mine.

Also, sometimes we may need not to stick with the ***equals()*** method properties for some exceptional cases like entity classes of JPA. It also deserves its own article.

### In Conclusion

All the important points for implementing the correct ***equals()*** method are covered in this article. I also recommend you to write the corresponding unit tests to test the validation of ***equals()*** method properties. Do not forget to look at the other resources that can be founded on the web.

On the first place, it seems like a very easy and primitive topic since it is from the fundamentals of object oriented design. However, as it is seen from the details that it is very important not to skip these basic concepts and fully understand.
