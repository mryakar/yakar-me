---
title: "Database Transactions and Spring’s Way of Managing Them"
description: "It is time to learn Database Transactions and Spring’s Transaction Management."
pubDate: 2023-12-26
topic: Databases
short: "Transactions and Spring"
mediumUrl: https://medium.com/havelsan/database-transactions-and-springs-way-of-managing-them-1ae30b8e6c5c
lang: en
---

## Introduction

In this article, we’ll begin by defining what a transaction is. Today, it’s a concept widely used in various professional domains. Our focus is specifically on database transactions. We’ll explore their definition, use cases, and key features. Once we’ve covered these foundational aspects, we’ll delve into the A.C.I.D. principles critical for successful transaction execution. Following that, we’ll address isolation and propagation properties, pivotal in determining transaction behavior. By the article’s end, we’ll gain valuable insights into transaction management in Spring Framework, including its advantages and abstraction mechanism. Finally, we’ll conclude with best practices essential for a software engineer to ensure a successful implementation.

For an engineer unfamiliar with transactions, this article is ideal as it begins right from the basics.

Let’s kick off by establishing some definitions.

---

## What is a Transaction?

The [Cambridge](https://dictionary.cambridge.org/dictionary/english/transaction) Dictionary provides multiple definitions of “transaction.” Here are the first two:

> An occasion when someone buys or sells something.

> The process of doing business.

In the context of databases, our focus lies on database transactions. [Wikipedia](https://en.wikipedia.org/wiki/Database_transaction) defines a database transaction as:

> A database transaction symbolizes a unit of work, performed within a database management system (or similar system) against a database, that is treated in a coherent and reliable way independent of other transactions. A transaction generally represents any change in a database.

In simple terms, a transaction is a collection of individual yet interconnected tasks that, in practice, act as a single unit. They rely on each other — if one fails, they all fail. In database systems, these interconnected tasks are referred to as transactions.

Transactions have two main purposes;

1. To manage multiple tasks and recover from failures without compromising the database’s consistency.
2. To ensure transactions operate independently without affecting one another, maintaining isolation.

These properties lead to principles transactions must adhere to. For instance, since a transaction is an individual unit of work, it must be atomic.

Let’s continue with these principles.

---

## A.C.I.D. Principles

In computer science, ACID principles (Atomicity, Consistency, Isolation, Durability) outline a set of properties that all transactions must uphold. These principles ensure data validity even in the face of errors, hardware issues, or any other factors that might compromise data or database integrity.

In brief, any group of database actions that meet the ACID principles is termed a transaction.

As we move forward discussing definitions and traits, we’ll utilize a unique SQL script. Our scenario is a fictional one, featuring three characters from a highly popular movie series: Harry Potter. We’ll explore each principle alongside Harry, Hermione, and Ron. Let’s start by reviewing the upcoming SQL script.

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

Imagine this script running within Hogwarts’ database system. Following its execution, we now have two tables: Houses and Wizards. Essentially, we’ve established a basic system to enroll new wizards at Hogwarts, with the option to assign them to a specific Hogwarts house, representing a distinctive group for wizards.

We also have specific constraints to adhere to when registering new wizards. One of these rules is that two wizards cannot share the same identification number. With this groundwork, let’s delve into the principles in more depth.

### Atomicity

The principle that governs the atomic nature of a transaction. As previously discussed, a transaction comprises tasks treated as a single unit of work. Simply put, either all sub-tasks within a transaction execute successfully, or none of them affect the database. In essence, it’s an all-or-nothing action.

Otherwise, it might compromise data integrity, potentially resulting in data loss caused by an unsuccessfully executed sub-task.

Let’s illustrate this principle with an example by writing some additional SQL script.

It’s time to enroll Harry, Hermione, and Ron at Hogwarts.

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

As seen in the movie series, Harry, Hermione, and Ron are inseparable friends. Their bond is crucial, and they can’t function well if one is absent. Consequently, we must register them together at Hogwarts. It’s an all-or-none scenario; either all of them are registered or none of them are.

In this heartfelt scenario, the insertion of their information is treated as a single unit of work, ensuring it’s carried out within a transaction. This transaction is atomic, guaranteeing its completion as a whole.

We start the transactional work with

```sql
BEGIN;
```

keyword. We can also use the following variations to do the same action;

```sql
BEGIN WORK;
-- or
BEGIN TRANSACTION;
```

Then we insert their information;

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (1, 'Harry', 'Pother', 1);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (2, 'Hermonie', 'Granger', null);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (3, 'Ron', 'Weasley', null);
```

Harry holds a special place for us, and that’s why we’ll assign him to one of the Hogwarts Houses first. Hermione and Ron will be assigned later.

To end the transaction, we use

```sql
COMMIT;
```

keyword. We can also use the following variations to complete the transaction;

```sql
COMMIT WORK;
-- or
COMMIT TRANSACTION;
```

Let’s execute this SQL script with an error. Change Ron’s identification number to null to simulate a situation where the official forgot to add an identification number for Ron.

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (null, 'Ron', 'Weasley', null);
```

You’ll notice that the SQL console raises an error because of the missing identification number for Ron. Consequently, none of them will be registered at Hogwarts. In simpler terms, none of their information will be inserted into the database. You can verify this by checking the rows in the tables.

Ultimately, our SQL statement adheres to the first principle of A.C.I.D.: ‘All will pass, or none shall pass.’

### Consistency

Another principle of ACID ensures the database moves from one consistent state to another without breaking any defined constraints. Essentially, a transaction shouldn’t make the data invalid or violate any rules set in the database. For instance, if we add a table with a column storing unique values, every row must possess its unique value.

Otherwise, it could result in a data anomaly within the database or the transaction itself, leading to a failure in upholding the intended business logic accurately.

However, modern database systems typically offer built-in solutions to enforce this principle. Therefore, it’s uncommon to encounter a transaction violating this principle when there’s a defined constraint in place. Let’s illustrate this with SQL concepts and scripts.

Let’s build upon our previous example. After registering at Hogwarts, Harry, Hermione, and Ron will each have their unique identification number. This protocol is crucial within the Hogwarts student management system. However, establishing this mandatory requirement must occur before any student registration. To ensure this, we’ve already applied a primary key constraint to our Wizards table. Let’s revisit our previous example.

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

Let’s revisit our straightforward transaction example. This time, the official responsible for registering wizards at Hogwarts makes an error and assigns the same identification number to Hermione and Ron. However, let’s assume the official initially registered Harry and Hermione. This time, Ron’s registration occurs in a separate SQL statement, meaning it’s outside of the initial transaction.

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (2, 'Ron', 'Weasley', null);
```

Because of the primary key constraint set initially, an error will be raised, causing the insert statement for Ron to fail. Ultimately, this preserves the consistency of the database.

***Note:****In PostgreSQL every statement is actually wrapped with*

```sql
BEGIN;
```

*and*

```sql
COMMIT;
```

*implicitly. This makes each particular statement as transactional.*

### Isolation

Often, a database used in a project is accessed by multiple clients or services, each executing their logic. Sometimes, these services may work on the same table simultaneously. This results in multiple transactions running concurrently. However, this can create scenarios where transactions fetch data from the database inconsistently because they’re not isolated from each other. In simpler terms, they interfere with one another. For instance, one transaction might read a value while another transaction has already processed it, leaving the first transaction with the previous version of the data. There can be various examples of such scenarios. These situations compromise the reliability of the data. To prevent such race conditions, there are approaches designed to isolate transactions from each other.

In our previous fictional scenario, envision multiple officials at Hogwarts registering new Wizards simultaneously. In technical terms, they’re executing their own database transactions in parallel.

We’ll dive into the specifics of potential incorrect reads and explain the corresponding isolation level that prevents such mistaken reads.

**Dirty Read:**Imagine one official at Hogwarts is updating the names of the Houses in the database as a transaction.

```sql
BEGIN;

UPDATE Houses SET name = 'Powerpuff Girls' where id=1;
UPDATE Houses SET name = 'Avengers' where id=2;
UPDATE Houses SET name = 'Ninja Turtles' where id=30;
UPDATE Houses SET name = 'Snow white and other Dwarfs' where id=4;

COMMIT;
```

Let’s say the first two houses, Gryffindor and Slytherin, were updated to Avengers and Powerpuff Girls within a transaction that hasn’t been committed or completed. Two update statements are still pending. Meanwhile, another official attempts to list the available Houses for Harry. Harry insists on seeing the actual names of the Houses before making a choice.

Initially, the official retrieves data from the Houses table using a simple SELECT query. The result displays four available Houses: Powerpuff Girls, Avengers, Ravenclaw, and Hufflepuff. This occurs because the second transaction reads the uncommitted changes from the first transaction. Ultimately, Harry informs the official of his desire to join the House of Powerpuff Girls, believing it suits his personality. The official then finalizes Harry’s registration with a straightforward insertion statement. Harry’s registration is now complete.

Keep in mind, the first official is still processing the insertion script concurrently. There’s no assurance that the first transaction will execute successfully as there are pending statements within the transaction.

Looking at our SQL script again, in the third update statement, Ravenclaw’s identification number is mistakenly written as 30 instead of 3. As there’s no House in the database with the identification number 30, the transaction will fail at this point, triggering a rollback of all uncommitted changes that were previously completed. Consequently, Harry’s House name reverts to Gryffindor. Harry and the official registering him at Hogwarts are unaware of this situation. It’s a pity Harry will eventually discover that he’s not in the Powerpuff Girls house. Poor Harry.

It’s common for occasional mistakes in SQL execution, but now we face a serious problem. The first transaction failed, so the data remained unchanged in the Houses table. However, the second transaction had already retrieved changes before the first transaction failed, and it will commit Harry’s information into the database.

The result is inconsistent because Harry was assigned to a house that doesn’t align with his preference or choice.

This unpleasant situation is called as **Dirty Read**.

A Dirty Read occurs when a transaction reads uncommitted data from another transaction.

It’s a scenario that’s highly probable, especially in databases accessed by multiple transactions, and should be considered.

Our initial isolation level is Read uncommitted, which is the lowest level. In this level, Dirty Reads can occur as it allows transactions to read each other’s uncommitted changes.

To prevent Dirty Reads, we need to opt for one of the other isolation levels available, such as Read Committed, Repeatable Read, or Serializable.

---

**Non Repeatable Read:**Let’s say Harry somehow discovered that his House isn’t the Powerpuff Girls, and he’s quite upset about it. He decides to change his House and approaches the official who registered him at Hogwarts, politely requesting a change to a House he prefers. The official, in a transactional manner, checks the available House names for Harry by executing a select statement on the Houses table to gather details about Harry’s House.

```sql
SELECT * FROM Houses WHERE id=1;
```

Keep in mind, Harry’s house identification number is 1. Upon inspection, they discover that the corresponding House name is Gryffindor, which Harry dislikes, and the official also disapproves of the current name. The official opts to directly change the House name instead of assigning Harry to a different House. Everyone in the House of Gryffindor will be pleased thanks to this decision, as most members dislike the current name. The official promptly begins the paperwork while Harry waits impatiently. Together, they decide to revert the name back to Powerpuff Girls.

Simultaneously, another official, unaware that Harry and the first official had begun the name-changing process, independently executes an update statement in the database to change Gryffindor to Powerpuff Girls. This action is executed as a transaction and is successful, resulting in committed changes to the database.

At a certain point, the first official, unsure of whether ‘Gryffindor’ has two ‘f’ letters or one, re-executes the previous select statement to confirm. The result astonishes him. He discovers that Gryffindor has already been changed to Powerpuff Girls. Turning to Harry, he attributes it to a miraculous occurrence — a spontaneous change in the House’s name. However, it’s not a miracle; Harry and the official are merely deluded. In reality, they’ve just experienced a **Non-repeatable Read** error.

Simply put, it’s an error that occurs when re-reading a row within a transaction yields a different result due to concurrent states of other transactions working on the same row simultaneously.

This scenario is quite possible. To prevent this, we should select an isolation level that’s higher and safer than Read Uncommitted and Read Committed. Options like Repeatable Read, which specifically prevents non-repeatable reads, or Serializable can be chosen.

---

**Phantom Read:**As time passes, Harry starts feeling bored with Hermione and Ron. Their friendship is fine, but Harry desires to expand his circle and make new friends, especially within his House. He decides to approach his trusted official, the one who handles all of Harry’s peculiar requests. Harry asks the official to list the wizards in Hogwarts. Following this request, the official executes a simple select query in the Wizards table.

```sql
SELECT *
FROM Wizards
WHERE house_id = (SELECT house_id
                  FROM Wizards
                  WHERE name = 'Harry' AND surname = 'Pother');
```

Unfortunately, they discover that the result contains only one wizard, and that’s Harry. This saddens him.

At the same time, another official registers a new wizard at Hogwarts named Draco Malfoy. Draco specifically requests to be placed in the Powerpuff Girls house because he’s eager to bully Harry. He insists on being in the same House as Harry. The official fulfills his request with an insertion statement, treating it as a transaction.

Seeing Harry’s disappointment, Harry’s caring official decides to check the database once more, holding onto a glimmer of hope. Perhaps Harry will find a great friendship with another wizard also in the Powerpuff Girls house. In the same transaction, he executes the same select statement once more and is immediately taken aback. There is now one more wizard. Excitedly, he informs Harry about this good news, grumbling about how the database system is so unreliable. However, he’s mistaken. He’s just experienced a **Phantom Read** error.

It’s a scenario that occurs quite commonly and is of utmost importance to address, particularly in banking systems, to prevent such reading issues.

To address this, we need to elevate the isolation level to the highest, which is Serializable.

---

That’s an insightful observation! Opting for the highest isolation level seems like the ultimate solution to resolve all read problems. However, it’s not always the case. While it does provide data consistency, it comes at the cost of performance. As you move from the lowest to the highest isolation level, query performance decreases significantly due to concurrent query executions.

To better understand, review the following figure. It illustrates the read errors associated with different isolation levels.

| Isolation level | Dirty reads | Non-repeatable reads | Phantom records |
|---|---|---|---|
| READ UNCOMMITTED | Yes | Yes | Yes |
| READ COMMITTED | No | Yes | Yes |
| REPEATABLE READS | No | No | Yes |
| SERIALIZABLE | No | No | No |

---

### Durability

This final principle ensures that even after a completed transaction, the system’s state remains intact despite power loss, hardware failures, or any issues preventing the proper functioning of the database system. Without this, data corruption or loss might occur.

Even if Voldemort cut off the electricity at Hogwarts, the data in the database will remain unaffected.

---

Dear reader, you’ve done really well so far. Thanks to Harry and others, we now have a clear understanding of A.C.I.D. principles. Let’s now delve into Spring’s Transaction Management, building on the background we’ve gained.

---

## The Actual Part: Spring’s Transaction Management

Transactions are divided into two distinct groups: global and local transactions. This concept applies similarly within Spring’s Transaction Management.

### Global Transactions

In essence, global transactions occur when you perform transactional actions across multiple transactional resources, such as multiple databases or message queues. These global transactions are handled using JTA (Java Transaction API). In this model, an application server oversees the accuracy of transaction execution. It’s important to note that most applications carry out transactions on a single resource.

### Local Transactions

Simply put, local transactions are performed on a single resource. Unlike global transactions, this model doesn’t involve an application server; all transactions occur within the application itself.Although there are other approaches like programmatic transaction management, we are going to continue with declarative transaction management.

---

We won’t delve deeply into the various transaction management specifics, but do note that these configurations can be set up using Spring’s Transaction Management.

It’s also viable to handle global transactions using Spring, but we won’t delve into the specifics here.

Remember, transaction management is a deep hole which you can dive deeper and deeper.

## Advantages of Spring’s Transaction Management

When we looked at local and global transactions earlier, they revealed certain drawbacks. For instance, changing environments while running your application might demand adjusting numerous configurations.

Spring’s Transaction Management offers essential mechanisms, enabling you to execute your transactional actions in any environment by handling all mechanisms within Spring itself.

In declarative transaction management, you simply add annotations to your classes or methods to guarantee transactional execution. It’s a simpler and recommended approach by Spring.

In essence, with Spring’s Transaction Management System, you don’t have to employ an external transaction manager or configure the transaction manager yourself.

## Manage Transactions at Service Level

We’ll proceed with declarative transaction management, as it’s the recommended method. In Spring, declarative transaction management is achieved through the application of the Proxy Pattern. To grasp the upcoming sections, it’s helpful to have a good understanding of the Proxy Pattern. You can read [one](https://medium.com/havelsan/spring-framework-beans-full-mode-and-lite-mode-6a16fae20149) of my articles to acquire that knowledge. Although it’s not solely focused on the Proxy Pattern, reading the related parts will prepare you for the upcoming content. Alternatively, there are numerous resources available online that you can explore.

There is an annotation called as **@Transactional**. We can use it at class level, method level or on interfaces(since Spring Framework 5.0) to declare a transactional state. Let’s start with interfaces;

```java
public interface Service { 
  
  void update(EntityModel entityModel);

  void deleteById(Long id);

}
```

Consider a class in the service layer called ‘Service Implementation,’ which implements the preceding interface. We can utilize the **@Transactional** annotation on the interface definition or on a method specified within the interface.

```java
@Transactional // Option 1
public interface Service { 
  
  @Transactional // Option 2
  void update(EntityModel entityModel);

  void deleteById(Long id);

}
```

With this approach all methods in the interface or methods in the interface that are annotated by **@Transactional**will be intercepted by the proxy and eventually become transactional.

On the previous versions of Spring Framework, annotating interfaces with **@Transactional** was not possible. By Spring Framework 5.0, it became applicable. However, this is not the recommended way to make the service layer transactional.

Java annotations aren’t inherited from interfaces. In cases using AspectJ, these annotations might be disregarded. This situation could lead to non-transactional business logic without your awareness, making it not an ideal choice.

On the other hand you can use **@Transactional** annotation on class level. Let’s now look at the following code snippet for this scenario;

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

Here, the class implements all methods in the Service interface, but this time the **@Transactional** annotation is applied at the class level. All methods with public, protected, or package-visible access modifiers are intercepted by the proxy. However, methods coming from the interfaces must use the public access modifier.

However, if a method is inherited from the parent class(es), it’s necessary to re-declare the method locally with the **@Transactional**annotation to ensure it becomes transactional, even if it’s already annotated in the parent class. While it’s a preferable approach to make the business logic transactional, it’s still not the best approach since you might forget to re-declare inherited methods, assuming they’ll be transactional when they won’t be.

There is still another option. Let’s see the following code snippet;

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

This approach is safer, because it is less likely to forget to make a part of the business logic transactional.

It is still possible to use these approaches in a combination. For example, you can use **@Transactional** at class level and method level at the same time. This creates a default transactional state and you can define a custom state for a particular method.

**Note:** Due to the nature of default proxy approach, invocations within the Service Implementation class(annotated class with **@Transactional**) will not be intercepted by the proxy even if the invoked method is annotated as **@Transactional**.

---

## Propagation Levels of Transactions in Spring

A transactional action may need to different transaction configurations including scope to be transactional, partial transaction, to be non-transactional, etc. Such states are adjusted with propagation levels.

Luckily, Spring provides many propagation levels for various transaction scenarios. It is set by a parameter of **@Transactional** annotation named by propagation;

```java
@Transactional(propagation = ...)
```

Let’s now go through them one by one;

### REQUIRED

Spring uses this propagation level as default. Within this level Spring check if there is an active transaction. If there is one, then the current action will be in this transaction. If there is no transaction, then Spring will create one for the current action.

### REQUIRES_NEW

If there is an active transaction, Spring suspends it and creates a new one. This is especially meaningful when there are nested actions which requires its own transaction.

### SUPPORTS

This propagation level is similar to REQUIRED propagation level. If there is an active transaction, the current action is going to use it. However, if there is no transaction, the current action will going to be executed as non-transactional.

### MANDATORY

This propagation level is also similar to REQUIRED propagation level. If there is an active transaction, the current action is going to use it. However, if there is none, then it will throw an exception.

### NEVER

As it is understood from the name of the propagation level, any transaction is not allowed. If there is an active transaction, Spring will throw an exception.

### NOT_SUPPORTED

It is similar to NEVER propagation level. Any transaction is again not allowed. However, Spring will handle is silently. If there is an active transaction, it will be suspended and the action will be executed as non-transactional.

### NESTED

With this level, Spring will check if there is an active transaction, and if so, it will put a save point there. If there occurs an exception in the business logic, Spring will rollback the current action to the save point.

---

## Isolation Levels of Transactions in Spring

Transactions require varying levels of isolation to execute successfully amidst other concurrent transactions. As mentioned earlier, concurrent execution can lead to issues. However, configuring the isolation level in Spring is straightforward — it’s another parameter within the **@Transactional**annotation.

```java
@Transactional(isolation = ...)
```

### DEFAULT

This is the default isolation level for transactions in Spring. When Spring initiates a transaction, its isolation level aligns with the database’s default isolation level. For instance, PostgreSQL’s default isolation level is READ COMMITTED. It’s important to exercise caution when using this level, as altering the database can lead to complications.

The rest of the levels remain the same as mentioned previously in the isolation principle section.

## Best Practices

By now, assuming you’ve read through this article, conducted additional research, and hopefully practiced, there are some best practices that I believe are worth mentioning.

### Nested Transactions

At times, you might need to structure your business logic with nested transactions. During such instances, it’s crucial to carefully consider the propagation levels. For instance, you might require a transaction to execute independently, irrespective of the outer transaction. Be mindful of this scenario.

### Manipulating Entities in Transactions

When utilizing JPA for your entities, it’s important to note that if you modify an entity at the Java level — such as invoking one of its setters — and apply the **@Transactional** annotation to your method, explicit saving isn’t necessary. Your transaction handles the persistence for you. This is a fundamental principle of JPA: any changes made to your entity within a transactional operation will be automatically persisted.

However, if you opt for persistence technologies other than JPA, remember to include save statements in your code to ensure proper persistence.

### Suppressing Exceptions in the Transaction

Consider a scenario where you have nested transactions within your business logic. You invoke another method from a different service, which might throw an exception. If you configure your current service’s method to rollback specifically for that exception and wrap the invocation of the outer service’s method in a try-catch block within the current service method, it won’t trigger a rollback on the current service’s method. Exercise caution with this approach and try to minimize the use of try-catch blocks where possible.

## Conclusion

We’ve covered quite a bit, and I hope Spring’s transaction management is clearer now.

Remember, there are numerous other resources available online. Feel free to explore those as well.

As always thanks for reading!
