---
title: "Las transacciones de base de datos y cómo las gestiona Spring"
description: "Es hora de aprender las transacciones de base de datos y la gestión de transacciones de Spring."
short: "Las transacciones y Spring"
mediumUrl: https://medium.com/havelsan/database-transactions-and-springs-way-of-managing-them-1ae30b8e6c5c
---

## Introducción

En este artículo empezaremos definiendo qué es una transacción. Hoy es un concepto muy usado en distintos ámbitos profesionales. Nos centraremos específicamente en las transacciones de base de datos. Exploraremos su definición, sus casos de uso y sus características clave. Una vez cubiertos estos aspectos fundamentales, profundizaremos en los principios A.C.I.D., críticos para que una transacción se ejecute con éxito. Después abordaremos las propiedades de aislamiento y de propagación, decisivas para determinar el comportamiento de las transacciones. Al final del artículo habremos adquirido ideas valiosas sobre la gestión de transacciones en Spring Framework, incluidas sus ventajas y su mecanismo de abstracción. Por último, terminaremos con buenas prácticas esenciales para que un ingeniero de software logre una implementación satisfactoria.

Para un ingeniero que no esté familiarizado con las transacciones, este artículo es ideal, porque empieza desde lo más básico.

Empecemos estableciendo algunas definiciones.

---

## ¿Qué es una transacción?

El diccionario [Cambridge](https://dictionary.cambridge.org/dictionary/english/transaction) da varias definiciones de “transaction”. Estas son las dos primeras:

> Ocasión en la que alguien compra o vende algo.

> El proceso de hacer negocios.

En el contexto de las bases de datos, nos centramos en las transacciones de base de datos. [Wikipedia](https://en.wikipedia.org/wiki/Database_transaction) define una transacción de base de datos así:

> Una transacción de base de datos simboliza una unidad de trabajo, realizada dentro de un sistema de gestión de bases de datos (o un sistema similar) sobre una base de datos, que se trata de forma coherente y fiable con independencia de otras transacciones. Una transacción representa, en general, cualquier cambio en una base de datos.

En términos sencillos, una transacción es un conjunto de tareas individuales pero interconectadas que, en la práctica, actúan como una sola unidad. Dependen unas de otras: si una falla, fallan todas. En los sistemas de bases de datos, estas tareas interconectadas reciben el nombre de transacciones.

Las transacciones tienen dos propósitos principales;

1. Gestionar varias tareas y recuperarse de los fallos sin comprometer la consistencia de la base de datos.
2. Garantizar que las transacciones funcionen de forma independiente, sin afectarse unas a otras, manteniendo el aislamiento.

Estas propiedades dan lugar a principios que las transacciones deben cumplir. Por ejemplo, como una transacción es una unidad de trabajo individual, debe ser atómica.

Sigamos con estos principios.

---

## Principios A.C.I.D.

En informática, los principios ACID (atomicidad, consistencia, aislamiento, durabilidad; en inglés Atomicity, Consistency, Isolation, Durability) describen un conjunto de propiedades que todas las transacciones deben respetar. Estos principios garantizan la validez de los datos incluso ante errores, problemas de hardware o cualquier otro factor que pueda comprometer los datos o la integridad de la base de datos.

En resumen, cualquier grupo de acciones sobre la base de datos que cumpla los principios ACID se denomina transacción.

A medida que avancemos con definiciones y rasgos, usaremos un script SQL propio. Nuestro escenario es ficticio y tiene como protagonistas a tres personajes de una saga cinematográfica muy popular: Harry Potter. Exploraremos cada principio junto a Harry, Hermione y Ron. Empecemos revisando el siguiente script SQL.

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

Imagina que este script se ejecuta en el sistema de base de datos de Hogwarts. Tras su ejecución, tenemos dos tablas: Houses y Wizards. En esencia, hemos montado un sistema básico para matricular a nuevos magos en Hogwarts, con la opción de asignarlos a una casa concreta de Hogwarts, que representa un grupo distintivo para los magos.

También tenemos restricciones concretas que respetar al registrar nuevos magos. Una de estas reglas es que dos magos no pueden compartir el mismo número de identificación. Con esta base, profundicemos en los principios.

### Atomicidad

Es el principio que rige la naturaleza atómica de una transacción. Como ya se ha dicho, una transacción se compone de tareas tratadas como una sola unidad de trabajo. Dicho sencillamente: o todas las subtareas de una transacción se ejecutan con éxito, o ninguna de ellas afecta a la base de datos. En esencia, es una acción de todo o nada.

De lo contrario, podría comprometerse la integridad de los datos, con una posible pérdida de datos causada por una subtarea ejecutada sin éxito.

Ilustremos este principio con un ejemplo escribiendo algo más de script SQL.

Es hora de matricular a Harry, Hermione y Ron en Hogwarts.

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

Como se ve en la saga, Harry, Hermione y Ron son amigos inseparables. Su vínculo es crucial y no funcionan bien si falta uno. Por tanto, debemos registrarlos juntos en Hogwarts. Es un escenario de todo o nada: o se registran todos o no se registra ninguno.

En este entrañable escenario, la inserción de sus datos se trata como una sola unidad de trabajo, lo que garantiza que se realice dentro de una transacción. Esta transacción es atómica, lo que garantiza que se complete como un todo.

Empezamos el trabajo transaccional con la palabra clave

```sql
BEGIN;
```

También podemos usar las siguientes variantes para hacer lo mismo;

```sql
BEGIN WORK;
-- or
BEGIN TRANSACTION;
```

Después insertamos sus datos;

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (1, 'Harry', 'Pother', 1);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (2, 'Hermonie', 'Granger', null);

INSERT INTO Wizards(id, name, surname, house_id)
VALUES (3, 'Ron', 'Weasley', null);
```

Harry ocupa un lugar especial para nosotros, y por eso lo asignaremos primero a una de las casas de Hogwarts. Hermione y Ron se asignarán más tarde.

Para terminar la transacción, usamos la palabra clave

```sql
COMMIT;
```

También podemos usar las siguientes variantes para completar la transacción;

```sql
COMMIT WORK;
-- or
COMMIT TRANSACTION;
```

Ejecutemos este script SQL con un error. Cambia el número de identificación de Ron a null para simular una situación en la que el funcionario olvidó añadir el número de identificación de Ron.

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (null, 'Ron', 'Weasley', null);
```

Verás que la consola SQL lanza un error por la falta del número de identificación de Ron. En consecuencia, ninguno de ellos quedará registrado en Hogwarts. Dicho de forma más sencilla, ninguno de sus datos se insertará en la base de datos. Puedes comprobarlo revisando las filas de las tablas.

En definitiva, nuestra sentencia SQL cumple el primer principio de A.C.I.D.: «Pasarán todos, o no pasará ninguno».

### Consistencia

Otro principio de ACID garantiza que la base de datos pase de un estado consistente a otro sin romper ninguna restricción definida. En esencia, una transacción no debe dejar los datos en un estado inválido ni violar ninguna regla establecida en la base de datos. Por ejemplo, si añadimos una tabla con una columna que almacena valores únicos, cada fila debe tener su propio valor único.

De lo contrario, podría producirse una anomalía de datos en la base de datos o en la propia transacción, y no se respetaría con precisión la lógica de negocio prevista.

Sin embargo, los sistemas de bases de datos modernos suelen ofrecer soluciones integradas para hacer cumplir este principio. Por eso es poco común encontrarse con una transacción que lo viole cuando hay una restricción definida. Ilustrémoslo con conceptos y scripts SQL.

Partamos de nuestro ejemplo anterior. Tras registrarse en Hogwarts, Harry, Hermione y Ron tendrán cada uno su número de identificación único. Este protocolo es crucial en el sistema de gestión de estudiantes de Hogwarts. Sin embargo, este requisito obligatorio debe establecerse antes de registrar a ningún estudiante. Para garantizarlo, ya hemos aplicado una restricción de clave primaria a nuestra tabla Wizards. Volvamos a nuestro ejemplo anterior.

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

Volvamos a nuestro sencillo ejemplo de transacción. Esta vez, el funcionario encargado de registrar a los magos en Hogwarts comete un error y asigna el mismo número de identificación a Hermione y a Ron. Sin embargo, supongamos que el funcionario registró primero a Harry y a Hermione. Esta vez, el registro de Ron se hace en una sentencia SQL aparte, es decir, fuera de la transacción inicial.

```sql
INSERT INTO Wizards(id, name, surname, house_id)
VALUES (2, 'Ron', 'Weasley', null);
```

Debido a la restricción de clave primaria definida al principio, se lanzará un error y la sentencia de inserción de Ron fallará. En definitiva, así se preserva la consistencia de la base de datos.

***Nota:*** *En PostgreSQL, cada sentencia se envuelve en realidad, de forma implícita, entre*

```sql
BEGIN;
```

*y*

```sql
COMMIT;
```

*Esto hace que cada sentencia concreta sea transaccional.*

### Aislamiento

A menudo, a la base de datos de un proyecto acceden varios clientes o servicios, cada uno ejecutando su lógica. A veces, estos servicios pueden trabajar sobre la misma tabla al mismo tiempo. Esto hace que se ejecuten varias transacciones de forma concurrente. Sin embargo, esto puede dar lugar a escenarios en los que las transacciones obtienen datos de la base de datos de forma inconsistente porque no están aisladas entre sí. Dicho de forma más sencilla, interfieren unas con otras. Por ejemplo, una transacción podría leer un valor cuando otra ya lo ha procesado, y la primera se queda con la versión anterior del dato. Puede haber muchos ejemplos de escenarios así. Estas situaciones comprometen la fiabilidad de los datos. Para evitar estas condiciones de carrera, existen enfoques pensados para aislar las transacciones entre sí.

En nuestro escenario ficticio anterior, imagina a varios funcionarios de Hogwarts registrando nuevos magos al mismo tiempo. En términos técnicos, están ejecutando sus propias transacciones de base de datos en paralelo.

Entraremos en los detalles de las posibles lecturas incorrectas y explicaremos el nivel de aislamiento correspondiente que evita cada una de ellas.

**Lectura sucia (dirty read):** Imagina que un funcionario de Hogwarts está actualizando los nombres de las casas en la base de datos como una transacción.

```sql
BEGIN;

UPDATE Houses SET name = 'Powerpuff Girls' where id=1;
UPDATE Houses SET name = 'Avengers' where id=2;
UPDATE Houses SET name = 'Ninja Turtles' where id=30;
UPDATE Houses SET name = 'Snow white and other Dwarfs' where id=4;

COMMIT;
```

Pongamos que las dos primeras casas, Gryffindor y Slytherin, se han actualizado a Avengers y Powerpuff Girls dentro de una transacción que todavía no ha hecho commit ni ha terminado. Quedan dos sentencias de actualización pendientes. Mientras tanto, otro funcionario intenta listar las casas disponibles para Harry. Harry insiste en ver los nombres reales de las casas antes de elegir.

Primero, el funcionario obtiene los datos de la tabla Houses con una simple consulta SELECT. El resultado muestra cuatro casas disponibles: Powerpuff Girls, Avengers, Ravenclaw y Hufflepuff. Esto ocurre porque la segunda transacción lee los cambios sin commit de la primera. Al final, Harry le dice al funcionario que quiere entrar en la casa de las Powerpuff Girls, porque cree que encaja con su personalidad. El funcionario completa entonces el registro de Harry con una sencilla sentencia de inserción. El registro de Harry ya está completo.

Ten en cuenta que el primer funcionario sigue procesando el script de inserción al mismo tiempo. No hay ninguna garantía de que la primera transacción se ejecute con éxito, porque dentro de ella hay sentencias pendientes.

Si volvemos a mirar nuestro script SQL, en la tercera sentencia de actualización el número de identificación de Ravenclaw se ha escrito por error como 30 en lugar de 3. Como no hay ninguna casa en la base de datos con el número de identificación 30, la transacción fallará en ese punto y provocará el rollback de todos los cambios sin commit que se habían completado antes. En consecuencia, el nombre de la casa de Harry vuelve a ser Gryffindor. Ni Harry ni el funcionario que lo registra en Hogwarts saben nada de esta situación. Es una pena que Harry acabe descubriendo que no está en la casa de las Powerpuff Girls. Pobre Harry.

Es habitual cometer algún error de vez en cuando al ejecutar SQL, pero ahora nos enfrentamos a un problema serio. La primera transacción falló, así que los datos de la tabla Houses no cambiaron. Sin embargo, la segunda transacción ya había leído los cambios antes de que la primera fallara, y hará commit de los datos de Harry en la base de datos.

El resultado es inconsistente, porque a Harry se le asignó una casa que no corresponde a su preferencia ni a su elección.

Esta situación desagradable se llama **lectura sucia** (Dirty Read).

Una lectura sucia se produce cuando una transacción lee datos sin commit de otra transacción.

Es un escenario muy probable, sobre todo en bases de datos a las que acceden varias transacciones, y hay que tenerlo en cuenta.

Nuestro nivel de aislamiento inicial es Read Uncommitted, el más bajo. En este nivel pueden producirse lecturas sucias, porque permite que las transacciones lean los cambios sin commit de las demás.

Para evitar las lecturas sucias, tenemos que optar por alguno de los otros niveles de aislamiento disponibles, como Read Committed, Repeatable Read o Serializable.

---

**Lectura no repetible (non-repeatable read):** Pongamos que Harry descubrió de algún modo que su casa no es la de las Powerpuff Girls y está bastante disgustado. Decide cambiar de casa y acude al funcionario que lo registró en Hogwarts para pedirle educadamente el cambio a una casa que prefiera. El funcionario, de forma transaccional, consulta los nombres de casa disponibles para Harry ejecutando una sentencia select sobre la tabla Houses para reunir los detalles de la casa de Harry.

```sql
SELECT * FROM Houses WHERE id=1;
```

Recuerda que el número de identificación de la casa de Harry es 1. Al consultarlo, descubren que el nombre de la casa correspondiente es Gryffindor, que a Harry no le gusta, y el funcionario tampoco aprueba el nombre actual. El funcionario opta por cambiar directamente el nombre de la casa en lugar de asignar a Harry a otra casa. Todos en la casa de Gryffindor estarán contentos con esta decisión, porque a la mayoría de sus miembros no les gusta el nombre actual. El funcionario se pone enseguida con el papeleo mientras Harry espera impaciente. Juntos deciden volver a poner el nombre de Powerpuff Girls.

Al mismo tiempo, otro funcionario, que no sabe que Harry y el primer funcionario han empezado el proceso de cambio de nombre, ejecuta por su cuenta en la base de datos una sentencia de actualización para cambiar Gryffindor por Powerpuff Girls. Esta acción se ejecuta como una transacción y tiene éxito, y los cambios quedan confirmados (commit) en la base de datos.

En un momento dado, el primer funcionario, sin saber si ‘Gryffindor’ lleva dos efes o una, vuelve a ejecutar la sentencia select anterior para confirmarlo. El resultado lo deja atónito. Descubre que Gryffindor ya se ha cambiado por Powerpuff Girls. Volviéndose hacia Harry, lo atribuye a un milagro: un cambio espontáneo en el nombre de la casa. Pero no es ningún milagro; Harry y el funcionario simplemente se engañan. En realidad, acaban de sufrir un error de **lectura no repetible** (Non-repeatable Read).

Dicho sencillamente, es un error que se produce cuando volver a leer una fila dentro de una transacción da un resultado distinto debido a los estados concurrentes de otras transacciones que trabajan sobre la misma fila al mismo tiempo.

Este escenario es bastante posible. Para evitarlo, deberíamos elegir un nivel de aislamiento más alto y más seguro que Read Uncommitted y Read Committed. Pueden elegirse opciones como Repeatable Read, que evita específicamente las lecturas no repetibles, o Serializable.

---

**Lectura fantasma (phantom read):** Con el tiempo, Harry empieza a aburrirse de Hermione y Ron. Su amistad va bien, pero Harry quiere ampliar su círculo y hacer nuevos amigos, sobre todo dentro de su casa. Decide acudir a su funcionario de confianza, el que atiende todas las peticiones peculiares de Harry. Harry le pide que liste a los magos de Hogwarts. Tras esta petición, el funcionario ejecuta una sencilla consulta select en la tabla Wizards.

```sql
SELECT *
FROM Wizards
WHERE house_id = (SELECT house_id
                  FROM Wizards
                  WHERE name = 'Harry' AND surname = 'Pother');
```

Por desgracia, descubren que el resultado contiene un solo mago, y es Harry. Esto lo entristece.

Al mismo tiempo, otro funcionario registra en Hogwarts a un nuevo mago llamado Draco Malfoy. Draco pide expresamente que lo pongan en la casa de las Powerpuff Girls porque está deseando acosar a Harry. Insiste en estar en la misma casa que Harry. El funcionario atiende su petición con una sentencia de inserción, tratada como una transacción.

Al ver la decepción de Harry, su atento funcionario decide consultar la base de datos una vez más, aferrándose a un rayo de esperanza. Quizá Harry encuentre una gran amistad con otro mago que también esté en la casa de las Powerpuff Girls. En la misma transacción, vuelve a ejecutar la misma sentencia select y se queda de inmediato desconcertado. Ahora hay un mago más. Entusiasmado, le da a Harry la buena noticia, mientras refunfuña sobre lo poco fiable que es el sistema de base de datos. Sin embargo, se equivoca. Acaba de sufrir un error de **lectura fantasma** (Phantom Read).

Es un escenario bastante común y de la máxima importancia, sobre todo en los sistemas bancarios, para evitar este tipo de problemas de lectura.

Para resolverlo, tenemos que subir el nivel de aislamiento al más alto, que es Serializable.

---

¡Buena observación! Optar por el nivel de aislamiento más alto parece la solución definitiva para resolver todos los problemas de lectura. Sin embargo, no siempre es así. Aunque proporciona consistencia de datos, lo hace a costa del rendimiento. A medida que pasas del nivel de aislamiento más bajo al más alto, el rendimiento de las consultas baja notablemente debido a las ejecuciones concurrentes de consultas.

Para entenderlo mejor, revisa la siguiente figura. Muestra los errores de lectura asociados a los distintos niveles de aislamiento.

| Nivel de aislamiento | Lecturas sucias | Lecturas no repetibles | Registros fantasma |
|---|---|---|---|
| READ UNCOMMITTED | Sí | Sí | Sí |
| READ COMMITTED | No | Sí | Sí |
| REPEATABLE READS | No | No | Sí |
| SERIALIZABLE | No | No | No |

---

### Durabilidad

Este último principio garantiza que, una vez completada una transacción, el estado del sistema se mantenga intacto pese a cortes de electricidad, fallos de hardware o cualquier problema que impida el buen funcionamiento del sistema de base de datos. Sin él, podrían producirse corrupción o pérdida de datos.

Aunque Voldemort cortara la electricidad en Hogwarts, los datos de la base de datos no se verían afectados.

---

Querido lector, lo has hecho muy bien hasta aquí. Gracias a Harry y a los demás, ahora entendemos con claridad los principios A.C.I.D. Profundicemos ahora en la gestión de transacciones de Spring, sobre la base que hemos adquirido.

---

## La parte de verdad: la gestión de transacciones de Spring

Las transacciones se dividen en dos grupos distintos: transacciones globales y transacciones locales. Este concepto se aplica de forma similar en la gestión de transacciones de Spring.

### Transacciones globales

En esencia, las transacciones globales se dan cuando realizas acciones transaccionales sobre varios recursos transaccionales, como varias bases de datos o colas de mensajes. Estas transacciones globales se gestionan con JTA (Java Transaction API). En este modelo, un servidor de aplicaciones supervisa la corrección de la ejecución de las transacciones. Hay que señalar que la mayoría de las aplicaciones realizan transacciones sobre un único recurso.

### Transacciones locales

Dicho sencillamente, las transacciones locales se realizan sobre un único recurso. A diferencia de las transacciones globales, este modelo no implica un servidor de aplicaciones; todas las transacciones ocurren dentro de la propia aplicación. Aunque hay otros enfoques, como la gestión programática de transacciones, seguiremos con la gestión declarativa de transacciones.

---

No profundizaremos en los distintos detalles de la gestión de transacciones, pero ten en cuenta que estas configuraciones pueden establecerse con la gestión de transacciones de Spring.

También es posible gestionar transacciones globales con Spring, pero aquí no entraremos en los detalles.

Recuerda que la gestión de transacciones es un pozo profundo en el que puedes sumergirte cada vez más.

## Ventajas de la gestión de transacciones de Spring

Cuando vimos antes las transacciones locales y globales, mostraron ciertos inconvenientes. Por ejemplo, cambiar de entorno al ejecutar tu aplicación podría exigir ajustar numerosas configuraciones.

La gestión de transacciones de Spring ofrece mecanismos esenciales que te permiten ejecutar tus acciones transaccionales en cualquier entorno, ya que el propio Spring se encarga de todos los mecanismos.

En la gestión declarativa de transacciones, basta con añadir anotaciones a tus clases o métodos para garantizar la ejecución transaccional. Es un enfoque más sencillo y el que recomienda Spring.

En esencia, con el sistema de gestión de transacciones de Spring no tienes que emplear un gestor de transacciones externo ni configurar tú mismo el gestor de transacciones.

## Gestionar las transacciones en la capa de servicio

Seguiremos con la gestión declarativa de transacciones, ya que es el método recomendado. En Spring, la gestión declarativa de transacciones se logra aplicando el patrón Proxy. Para entender las próximas secciones, conviene conocer bien el patrón Proxy. Puedes leer [uno](https://medium.com/havelsan/spring-framework-beans-full-mode-and-lite-mode-6a16fae20149) de mis artículos para adquirir ese conocimiento. Aunque no se centra solo en el patrón Proxy, leer las partes relacionadas te preparará para lo que viene. También hay numerosos recursos en internet que puedes explorar.

Existe una anotación llamada **@Transactional**. Podemos usarla a nivel de clase, a nivel de método o en interfaces (desde Spring Framework 5.0) para declarar un estado transaccional. Empecemos por las interfaces;

```java
public interface Service { 
  
  void update(EntityModel entityModel);

  void deleteById(Long id);

}
```

Considera una clase de la capa de servicio llamada ‘Service Implementation’, que implementa la interfaz anterior. Podemos usar la anotación **@Transactional** en la definición de la interfaz o en un método especificado en ella.

```java
@Transactional // Option 1
public interface Service { 
  
  @Transactional // Option 2
  void update(EntityModel entityModel);

  void deleteById(Long id);

}
```

Con este enfoque, todos los métodos de la interfaz, o los métodos de la interfaz anotados con **@Transactional**, serán interceptados por el proxy y acabarán siendo transaccionales.

En las versiones anteriores de Spring Framework no era posible anotar las interfaces con **@Transactional**. Desde Spring Framework 5.0 se puede. Sin embargo, esta no es la forma recomendada de hacer transaccional la capa de servicio.

Las anotaciones de Java no se heredan de las interfaces. En los casos en que se usa AspectJ, estas anotaciones pueden ignorarse. Esta situación podría dar lugar a una lógica de negocio no transaccional sin que te des cuenta, así que no es una opción ideal.

Por otro lado, puedes usar la anotación **@Transactional** a nivel de clase. Veamos el siguiente fragmento de código para este escenario;

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

Aquí la clase implementa todos los métodos de la interfaz Service, pero esta vez la anotación **@Transactional** se aplica a nivel de clase. Todos los métodos con modificadores de acceso public, protected o de visibilidad de paquete son interceptados por el proxy. Sin embargo, los métodos que vienen de las interfaces deben usar el modificador de acceso public.

Sin embargo, si un método se hereda de la clase o clases padre, hay que volver a declararlo localmente con la anotación **@Transactional** para garantizar que sea transaccional, aunque ya esté anotado en la clase padre. Aunque es un enfoque preferible para hacer transaccional la lógica de negocio, sigue sin ser el mejor, porque podrías olvidarte de volver a declarar los métodos heredados, dando por hecho que serán transaccionales cuando no lo serán.

Todavía hay otra opción. Veamos el siguiente fragmento de código;

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

Este enfoque es más seguro, porque es menos probable olvidarse de hacer transaccional una parte de la lógica de negocio.

También es posible combinar estos enfoques. Por ejemplo, puedes usar **@Transactional** a nivel de clase y a nivel de método al mismo tiempo. Así se crea un estado transaccional por defecto y puedes definir un estado personalizado para un método concreto.

**Nota:** Debido a la naturaleza del enfoque de proxy por defecto, las invocaciones dentro de la clase Service Implementation (la clase anotada con **@Transactional**) no serán interceptadas por el proxy aunque el método invocado esté anotado como **@Transactional**.

---

## Niveles de propagación de las transacciones en Spring

Una acción transaccional puede necesitar distintas configuraciones de transacción, como un ámbito transaccional, una transacción parcial o no ser transaccional, etc. Estos estados se ajustan con los niveles de propagación.

Por suerte, Spring ofrece muchos niveles de propagación para distintos escenarios de transacción. Se establece con un parámetro de la anotación **@Transactional** llamado propagation;

```java
@Transactional(propagation = ...)
```

Repasémoslos ahora uno a uno;

### REQUIRED

Spring usa este nivel de propagación por defecto. En este nivel, Spring comprueba si hay una transacción activa. Si la hay, la acción actual se ejecutará en esa transacción. Si no hay ninguna, Spring creará una para la acción actual.

### REQUIRES_NEW

Si hay una transacción activa, Spring la suspende y crea una nueva. Esto tiene especial sentido cuando hay acciones anidadas que requieren su propia transacción.

### SUPPORTS

Este nivel de propagación es similar a REQUIRED. Si hay una transacción activa, la acción actual la usará. Sin embargo, si no hay ninguna, la acción actual se ejecutará de forma no transaccional.

### MANDATORY

Este nivel de propagación también es similar a REQUIRED. Si hay una transacción activa, la acción actual la usará. Sin embargo, si no hay ninguna, lanzará una excepción.

### NEVER

Como se entiende por el nombre del nivel de propagación, no se permite ninguna transacción. Si hay una transacción activa, Spring lanzará una excepción.

### NOT_SUPPORTED

Es similar al nivel de propagación NEVER. Tampoco se permite ninguna transacción. Sin embargo, Spring lo gestionará en silencio. Si hay una transacción activa, se suspenderá y la acción se ejecutará de forma no transaccional.

### NESTED

Con este nivel, Spring comprobará si hay una transacción activa y, si la hay, pondrá ahí un punto de guardado (savepoint). Si se produce una excepción en la lógica de negocio, Spring hará el rollback de la acción actual hasta el punto de guardado.

---

## Niveles de aislamiento de las transacciones en Spring

Las transacciones requieren distintos niveles de aislamiento para ejecutarse con éxito en medio de otras transacciones concurrentes. Como se mencionó antes, la ejecución concurrente puede causar problemas. Sin embargo, configurar el nivel de aislamiento en Spring es sencillo: es otro parámetro de la anotación **@Transactional**.

```java
@Transactional(isolation = ...)
```

### DEFAULT

Es el nivel de aislamiento por defecto de las transacciones en Spring. Cuando Spring inicia una transacción, su nivel de aislamiento coincide con el nivel de aislamiento por defecto de la base de datos. Por ejemplo, el nivel de aislamiento por defecto de PostgreSQL es READ COMMITTED. Conviene tener cuidado al usar este nivel, ya que cambiar de base de datos puede dar lugar a complicaciones.

El resto de los niveles son los mismos que se mencionaron antes en la sección del principio de aislamiento.

## Buenas prácticas

A estas alturas, suponiendo que hayas leído este artículo, hayas investigado por tu cuenta y, ojalá, hayas practicado, hay algunas buenas prácticas que creo que vale la pena mencionar.

### Transacciones anidadas

A veces puede que necesites estructurar tu lógica de negocio con transacciones anidadas. En esos casos, es crucial pensar bien los niveles de propagación. Por ejemplo, puede que necesites que una transacción se ejecute de forma independiente, sin importar la transacción exterior. Ten presente este escenario.

### Manipular entidades dentro de transacciones

Cuando uses JPA para tus entidades, es importante tener en cuenta que, si modificas una entidad a nivel de Java (por ejemplo, invocando uno de sus setters) y aplicas la anotación **@Transactional** a tu método, no hace falta guardarla explícitamente. Tu transacción se encarga de la persistencia por ti. Es un principio fundamental de JPA: cualquier cambio hecho en tu entidad dentro de una operación transaccional se persistirá automáticamente.

Sin embargo, si optas por tecnologías de persistencia distintas de JPA, recuerda incluir sentencias de guardado en tu código para garantizar una persistencia correcta.

### Suprimir excepciones dentro de la transacción

Considera un escenario en el que tienes transacciones anidadas en tu lógica de negocio. Invocas otro método de un servicio distinto, que podría lanzar una excepción. Si configuras el método de tu servicio actual para que haga rollback específicamente ante esa excepción y envuelves la invocación del método del servicio exterior en un bloque try-catch dentro del método del servicio actual, no se desencadenará un rollback en el método del servicio actual. Ten cuidado con este enfoque e intenta reducir al mínimo el uso de bloques try-catch siempre que sea posible.

## Conclusión

Hemos cubierto bastante terreno, y espero que la gestión de transacciones de Spring esté ahora más clara.

Recuerda que hay muchísimos otros recursos disponibles en internet. No dudes en explorarlos también.

Como siempre, ¡gracias por leer!
