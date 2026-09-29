---
title: "Testing Private Methods!"
description: "Private methods. To test or not to test? That is a serious question."
pubDate: 2022-04-15
topic: Java
short: "Testing Private Methods!"
mediumUrl: https://medium.com/havelsan/testing-private-methods-afbda842d44a
---

![Illustration of a scientist in a lab coat testing code on a laptop, with glassware and checklists around him.](./bugfender-illustration.jpeg)

*Image credit: Marc Moreno on [BugFender](https://bugfender.com/blog/how-to-write-unit-tests-for-kotlin/).*

In object oriented design, naturally the objects are interacting each other which makes them clients of each other, indeed. Actually, just after this, the very first clients of an object are the [unit tests](https://en.wikipedia.org/wiki/Unit_testing).

The all ***public*** functionalities of the object are used by unit tests for testing purposes like a real client in the production environment is using these functionalities for the sake of its business. As it is supposed to be, the internal functionalities may not be served to the clients because they are irrelevant to them. So according to this point of view, private methods ***must be primitively simple*** or ***must not need***to be tested.

When developers tests the private methods, they normally end the day with complex, unnecessary and boilerplate code which is a sign that unit testing is not only the way to test the functionality but also ***a tool*** to see possible design flaws. Let’s get into the details on this sentence with a ***very basic*** example but first we need to check a very basic concept of software engineering.

## Single Responsibility Principle (SRP)

In short, as it is stated by the name itself, the single responsibility principle is a programming principle which every part of program must be responsible for ***only one job***. In another saying, each part must only serve the functionality that is related to what it is supposed to do. These parts may be a class, a module or the program itself. We are going to stick with a class this time. For detailed information about this principle, you can check [this](https://en.wikipedia.org/wiki/Single-responsibility_principle) out.

## Let’s Get Hands Dirty

Amazingly, I say amazingly because when I learn this I was like “wow that is amazing”, when you find yourself in a situation that you need to test private methods of a class to ensure the functionality of the class is correctly implemented or coverage is good enough, you ***most probably*** have violated the ***SRP***.

Let’s see the upcoming ***Java*** code snippet which is a sample class for such a scenario;

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

Here we see a simple Student class with a couple of attributes and two different methods which the one of them has public access modifier and the other has private. Normally, taking an exam is a behavior of the student class. However, in a normal situation, students are not supposed to prepare and create his/her own student identification card.

In this scenario, ***takeExam()*** method is dependent to another method in order to provide its function fully. On the other hand, ***createIdCard()*** method is serving an inner functionality for the sake of another functionality and since it is declared as a private method it cannot be reached from outside the class ***including from unit tests***. Also, since it ***relatively*** has a complex logic rather than the other parts of the class, not ensuring that everything is working properly within the function can give you really bad headaches in the next stages of development or even in the production stage.

So what options do we have in order to solve this problem? There may be a couple of approaches.

## Possible Approaches

### Testing Private Methods (DON’T)

Let’s start with testing this private method which may be ***the worst one***. There are ways to achieve this with using some core features of programming language. For example, in C# we have [PrivateObject](https://docs.microsoft.com/en-us/previous-versions/visualstudio/visual-studio-2013/ms245564%28v=vs.120%29) which gives you the ability to call a private property or method within the test. Also we have [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html) in Java which provides the same functionality or the annotation of [Jailbreak](https://github.com/manifold-systems/manifold/blob/master/manifold-deps-parent/manifold-ext/README.md#type-safe-reflection-via-jailbreak) which is provided by [Manifold Compiler Plugin](http://manifold.systems/) is also using [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html). However, choosing this approach is going to be time consuming for development time and also running time and creates ***unnecessary* *complexity****.* According to one of the basic principles of unit tests that is ***being able to run fast***, this approach is violating it because [Reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html) and similar libraries are really hungry for processing time. Also, you test a function which normally you cannot use in the production as a client. This also creates a meaningless situation. It is like buying a mobile phone and specifically checking whether its super duper microprocessor can do some complex mathematical calculations like integral by disassembling and connecting it to a special tester device. It is time consuming and difficult as a normal client, isn’t it? Most importantly, it creates redundant complexity for a simple buying action. These functions need their testing in a mobile phone factory. The functions of the mobile phone that you must test are the ones that are easily and normally reachable from a client side. For example, you test it whether you can switch it on and off, have a phone call, see the display is have three colors etc. Be careful. Here is tricky. We can think that the mobile phone factory is also another client for those tests that you normally should not run.

### Leave Private Methods as They are (Not Recommended)

Let’s assume that you have implemented your current business logic and unit tests for all public methods and they all pass. However, there are still some parts that belong to your business logic left untested directly but through your public methods. You kept developing your code and add some new features. After sometime you needed to add some logic in your private methods or change the signature of them because they are used in other logical parts, too. Then you see some red crosses on the test suite which means you break some logic. Now, you have to rewrite your corresponding tests to adapt the logic which requires more time and shows lack of confidence on your tests and also on your code design. This is the same with when you needed to rewrite your already designed and implemented code parts which is a sign of poorly designed structure. Most of the time, dealing with such scenarios requires more and more refactoring and obviously more time. On the other hand, in professional life, you inevitably may come a point that you are required to work with another developers or change your job to another. This new coming poor developer may also face with the same situation and need to add some features or etc. Then it would be harder for him/her to overcome with the situation because he/she is not the who wrote the code itself and this is again just going to cost more time. As it is seen, this is mostly about the time amount that is dedicated to the project.

### Extract New Parts (Go for it!)

As it was stated at the beginning of this article, when you are in a need to test your private methods, you most probably violate SRP. In other means, your class is doing too much. Now, it may be a good time to think about refactoring your existing class structure and extract some new classes from there. Let’s refactor the previous ***very simple*** code snippet into two different parts;

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

As we can see, the creation of student cards is not a responsibility of students. After refactoring and extracting a new class, now we can test each function separately by [***mocking***](https://en.wikipedia.org/wiki/Mock_object) the components in each class and also satisfy the SRP. There is a framework called [Mockito](https://site.mockito.org/) but it deserves its own article. This approach will decrease the chance of any future errors or unwanted design flaws.

## In Conclusion

Even if I presented a couple of approaches to overcome this problem, there are still another available solutions or counter arguments to this situation. Personally, I mostly stick with the last option.

As it is seen, unit testing is not only a way to test the functionality but also an indicator of how solid your design is.
