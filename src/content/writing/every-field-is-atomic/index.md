---
title: "Every Field Is Atomic. The Balance Is Still Negative."
description: "No lock anywhere, and the account still overdraws. What compare-and-set does, what it actually compares, and when it runs your code twice."
pubDate: 2026-11-03
topic: Java
short: "Every Field Is Atomic"
mediumUrl: https://medium.com/@mr-yakar/every-field-is-atomic-the-balance-is-still-negative-bcd22afc9c3a
lang: en
---

## TL;DR

- An `AtomicLong` balance, no locks, 8 threads withdrawing 100 from 100: the balance went negative in 4,550–5,683 of 10,000 rounds, down to -700. Each call was atomic. The check and the write together were not.
- The same program with a `compareAndSet` loop: 0 overdrawn rounds, in 5 of 5 runs.
- That loop is the same idea as the version column from the PostgreSQL article, one layer down: write only if nothing changed, otherwise start over.
- On x86, the compiled `getAndIncrement` is a single instruction with no loop around it. Switch that optimization off and it becomes a compare-and-set, with a retry loop once threads compete.
- `updateAndGet` ran its function 31,339,201–39,623,599 times for 8,000,000 updates on 8 threads. The function must have no side effects.
- No lock does not mean no waiting: at 8 threads, 1.11–2.20 attempts failed for every success, one increment took 6,694 tries, and a thread dump showed nothing unusual.
- `LongAdder` trades memory for throughput on hot counters. It has no compare-and-set and its `sum()` is not a snapshot, so never check a balance with it.
- `compareAndSet` compares references: on a default JVM, 127 matches and 1000 does not. It cannot see 100 -> 50 -> 100 either. A stamp can.
- Two fields that must change together: two `AtomicLong`s let 600–797 of 10,000 windows go over a limit of 10. One immutable record: 0.

> ***Environment for every output in this article:*** *Intel Core i7-4700HQ (4 cores / 8 threads, x86-64), 16 GB DDR3-1600, Ubuntu 26.04, Amazon Corretto 25.0.4 (every demo also run on 21.0.11, same direction). Counts will differ on your machine; the direction will not. The machine-code section needs x86-64.*

**Source code.** Every program is in the [`article-examples`](https://github.com/mryakar/article-examples) repository, under `cas-atomic-classes/`. Each demo is one Java file with no dependencies; the README has the command for each.

---

## Every Field Is Atomic

The account from the `synchronized` article is back. There, two locks on two accounts deadlocked. Here there is no lock at all — so no deadlock either.

The balance is an `AtomicLong`. A withdrawal reads it with `get()` and writes it with `addAndGet()`:

```java
static boolean withdraw(Account from, long amount) {
    if (from.balance.get() >= amount) {
        from.balance.addAndGet(-amount);
        return true;
    }
    return false;
}
```

Read it line by line and nothing looks wrong. Every call on the balance is atomic.

Account `"A"` starts with 100. Eight threads try to withdraw 100 from it at the same moment, so at most one of them should succeed. The program repeats this 10,000 times and counts the rounds that end below zero. Five runs:

```
overdrawn 4567/10000 rounds, lowest -700
overdrawn 5683/10000 rounds, lowest -700
overdrawn 5450/10000 rounds, lowest -700
overdrawn 4615/10000 rounds, lowest -600
overdrawn 4550/10000 rounds, lowest -600
```

On JDK 25, about half of the rounds overdrew, in every run. A balance of -700 means all eight threads withdrew: 100 was there, 800 went out.

Every call on the balance was atomic. So where did the overdraft come from?

### In short

- An `AtomicLong` balance, no locks, eight threads withdrawing 100 from 100 at once.
- Every call on the balance is atomic.
- The balance went negative in 4,550–5,683 of 10,000 rounds, in all 5 runs.
- In the worst rounds all eight withdrew, and the balance ended at -700.

---

## What One Atomic Call Buys You

The first Java article ended with a counter that lost updates. `count++` is a read, an add and a write, and two threads can both sit inside those three steps.

Here is that counter twice. Two threads, a million increments each; only the type of the counter changes. Two of the five runs:

```
volatile int : 927,485 of 2,000,000
AtomicInteger: 2,000,000 of 2,000,000
volatile int : 1,343,315 of 2,000,000
AtomicInteger: 2,000,000 of 2,000,000
```

`AtomicInteger` lost nothing, in every run. Its `incrementAndGet()` reads, adds and writes as **one indivisible step**. No other thread can see or change the value halfway through.

That is the whole guarantee, but it has a limit: it covers **one call**. Put two atomic calls next to each other and you get two atomic steps, not one. Between them, every other thread is free to run.

That is exactly what `withdraw` does. `get()` is atomic. `addAndGet()` is atomic. Between them, other threads also read 100, also pass the check, and also write. Each check was true when it ran. By the time its write ran, it was no longer true.

Two atomic calls leave a gap. What closes it?

### In short

- `AtomicInteger` fixes the counter from the first article: 2,000,000 of 2,000,000, every run.
- The same work with `volatile int` kept 927,485–1,343,315.
- The guarantee is per call. Two atomic calls in a row are not one atomic operation.
- The overdraft happens between the check and the write.

---

## Compare-and-Set: The Conditional Write

The fix is not a lock. It is a condition on the write.

`compareAndSet(expectedValue, newValue)` writes only if the value is still the one you expected, and tells you whether it did. In the words of the documentation, it *"atomically sets the value to `newValue` if the current value `== expectedValue`."* Nobody waits. A thread that loses gets `false` back and decides what to do next.

A withdrawal becomes a loop: read the balance, check it, try to write, and start over if someone else wrote first:

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

Several threads can still read 100 and pass the check. Only one `compareAndSet` finds 100 there. The ones that lose find 0, write nothing, and go around the loop again — where the check now fails.

![Animation: two threads both read a balance of 100 and both pass the check. Thread A's compare-and-set succeeds and the balance becomes 0. Thread B's compare-and-set fails because the balance is no longer 100. Thread B reads again, sees 0, and withdraws nothing.](./cas-withdraw.gif "The thread that loses does not write. It reads again, and this time the check says no.")

Same program, same eight threads, same 10,000 rounds; only the body of `withdraw` changed. All five runs printed the same line:

```
cas             overdrawn 0/10000 rounds, lowest 0
```

If you read the PostgreSQL article on explicit locking, you have seen this before. It ended with *"a third option that belongs to neither column"*:

```sql
UPDATE accounts SET balance = ?, version = version + 1
 WHERE id = ? AND version = ?;
```

and with the line *"That is compare-and-set, written in SQL. Java has the same idea in hardware — and that is the next article."* This is that article. The version column and `compareAndSet` share one idea: write only if nothing changed since you read, otherwise start over. One guards a row, the other a memory cell.

### In short

- `compareAndSet` writes only if the value is still the one you read. Nobody waits.
- A withdrawal becomes a loop: read, check, compare-and-set, start over if it failed.
- Same program, one loop added: 0 overdrawn rounds in 10,000, in all 5 runs.
- It is the same idea as the version column from the PostgreSQL article, one layer down.

---

## One Instruction Underneath

How can compare-and-set itself be one step? The `synchronized` article promised *"compare-and-swap, and the atomic classes built on it."* This section looks at what those classes are built on.

On x86, compare-and-set is a single processor instruction, `lock cmpxchg`: compare and write in one step that no other core can split. It can still fail, so it sits inside a loop like the one above. Does every atomic class run that loop? Not the most common method. When the JIT compiles `getAndIncrement()`, it uses a different instruction, `lock xadd`, which adds and returns the old value in one step. There is nothing to compare, so nothing to try again. Switch that optimization off, and the same method goes back to `lock cmpxchg`:

```
getAndIncrement: lock xadd, loop: no
intrinsic off  : lock cmpxchg, loop: no
off, 4 threads : lock cmpxchg, loop: yes
```

Five runs, the same three lines. The loop only shows up in the compiled code when threads compete. With one thread there was no competition, and the JIT compiled the failure path as a rare exit back to slower code instead of a loop. How to print and read this machine code is in the repository's README. You do not need it to use the class.

### In short

- Compare-and-set is one CPU instruction that can fail, so it sits inside a loop.
- On x86, compiled `getAndIncrement` is one instruction with no loop around it.
- Switch that optimization off and it becomes a compare-and-set, with a retry loop once threads compete.

---

## The Loop Can Run Your Code Twice

You rarely write that loop by hand. `updateAndGet(fn)` writes it for you: read the value, apply your function, compare-and-set the result, start over if another thread got there first. Starting over means calling your function again. The documentation says so directly: *"The function should be side-effect-free, since it may be re-applied when attempted updates fail due to contention among threads."*

How often? This function counts its own calls, a million updates per thread:

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

With one thread, every update succeeded on the first try: one call per update. With eight threads, the highest and lowest of five runs show **about four to five calls for every update**, on this machine. Counting the calls is itself one more shared update, so it adds to the contention. The final value was correct every time. Only the side effect multiplied.

So nothing goes inside that function except computing the new value. A log line would print several times for one update. A counter would count too much. A call to another service would be made several times.

The MVCC article had the same rule one layer up, for a database transaction: *"The transaction body will run more than once."* Here the body is your lambda.

### In short

- `updateAndGet` runs the compare-and-set loop for you — including your function.
- With 8 threads, the function ran 31,339,201–39,623,599 times for 8,000,000 updates.
- With 1 thread, calls and updates were equal: 1,000,000 each.
- Keep the function pure: no logging, no I/O, no counters of its own.

---

## No Lock Does Not Mean No Waiting

The previous section counted calls to the function. This one counts the attempts themselves: a compare-and-set loop that counts its own failures and does nothing else, a million increments per thread, with 1, 2, 4 and 8 threads.

```
1 thread : 0.00 failed per success, worst 1
2 threads: 0.72 failed per success, worst 2092
4 threads: 0.89 failed per success, worst 849
8 threads: 2.20 failed per success, worst 6694
```

Each line is the fifth of five runs for that thread count. With one thread, nothing ever failed. With eight, one to two attempts failed for every one that succeeded — between 1.11 and 2.20 across the five runs. The worst single increment changes a lot between runs; in one run it took 6,694 tries.

The reason is that every thread fights over the same memory location, and only one attempt at a time can win. The first Java article showed that the hardware keeps caches in sync: one core writes, the others are told. Here all eight threads work on that one location at once.

No thread waits for a lock, but every thread waits for its turn to win. And nothing shows it. Here is a thread dump taken while eight threads spin:

```
dump: RUNNABLE 8/8, waiting to lock 0, parked 0
dump: deadlock reported: no
```

All eight are `RUNNABLE`. Nothing waits for a lock, nothing is parked, no deadlock. In the `synchronized` article, the dump pointed straight at the problem. Here there is nothing to point at. You only see this kind of contention if you count it.

### In short

- No thread waited for a lock, yet at 8 threads 1.11–2.20 attempts failed for each success.
- One single increment took 6,694 tries.
- A thread dump showed all 8 threads RUNNABLE and nothing waiting. You only see this if you count.

---

## LongAdder: Stop Fighting Over One Cell

If everyone fights over one cell, give them more cells. The first Java article listed *"`LongAdder` when the counter is hot and heavily contended"* and said it deserves an article of its own.

The idea is simple. When threads compete, a `LongAdder` spreads the count over several variables, so different threads update different ones. Reading it adds them up.

How much faster is that? This article has no benchmark for it, and will not guess. The documentation states the expectation: *"Under low update contention, the two classes have similar characteristics. But under high contention, expected throughput of this class is significantly higher, at the expense of higher space consumption."*

The price is in the read. For `sum()`, the documentation says: *"The returned value is NOT an atomic snapshot; invocation in the absence of concurrent updates returns an accurate result, but concurrent updates that occur while the sum is being calculated might not be incorporated."* The class description already says what it is for: statistics, *"not for fine-grained synchronization control."*

So back to the opening: **a balance is never a `LongAdder`.** It has no compare-and-set: it can add, but it cannot write only if a check still holds. And `sum()` can miss the updates that happen while it adds.

### In short

- `LongAdder` spreads a hot counter over several variables and adds them up when you read.
- Its documentation expects much higher throughput under heavy contention, paid in memory.
- It has no compare-and-set, and `sum()` is not a snapshot. Never use it for a value you check before acting.

---

## What compareAndSet Actually Compares

`compareAndSet` asks one question: is the value still the one I read? There are two ways the answer can mislead you.

**It compares references.** For an `AtomicReference`, the write happens *"if the current value `== expectedValue`"* — `==`, not `equals()`. Put boxed numbers in it and try `compareAndSet(127, 128)` on a reference holding 127, then `compareAndSet(1000, 1001)` on one holding 1000:

```
default JVM:   CAS(127) = true  CAS(1000) = false
cache 1000:    CAS(127) = true  CAS(1000) = true
```

On a default JVM, 127 matched and 1000 did not. The JVM reuses one `Integer` object for small values, so both `127`s are the same object; each `1000` is a new one. The second line is the same program with a larger cache:

```
java -XX:AutoBoxCacheMax=1000 IdentityTrap cache1000
```

Now 1000 matches too. The language guarantees a shared object only from -128 to 127; beyond that, it depends on the JVM. For numbers, `AtomicInteger` avoids the question entirely. The rule is short: **pass the reference you read** as the expected value, not a new value that looks equal.

**It cannot see history.** A thread reads a balance of 100 and is about to write 70. Before it does, another thread changes the balance to 50, then back to 100. The first thread's `compareAndSet(100, 70)` succeeds — the value is the same. But somebody touched it in between. "Same value" and "nobody touched it" are different statements. This is the **ABA problem**. For a plain number it does no harm: 70 is still the right result. It matters when the value stands for more than itself — when "nothing changed since I read it" is the rule you are enforcing.

`AtomicStampedReference` keeps an integer stamp next to the value and compares both. Every writer must move the stamp, so a change and its undo still leave a mark:

![Animation: thread A reads a balance of 100 with stamp 0 and pauses. Another thread changes the balance to 50 and back to 100, and the stamp moves to 2. A plain compareAndSet from 100 to 70 succeeds. The stamped compareAndSet fails because the stamp is 2, not 0.](./aba.gif "Comparing values tells you the value is the same, not that nobody touched it.")

```
plain   : CAS(100 -> 70) = true
stamped : CAS(100 -> 70) = false (stamp 0, now 2)
```

A version column is the same stamp. `WHERE balance = ?` would not notice 100 -> 50 -> 100. `WHERE version = ?` would.

### In short

- `compareAndSet` on an `AtomicReference` compares references, not `equals()`.
- On a default JVM, 127 matched and 1000 did not. Pass the reference you read.
- It cannot see 100 -> 50 -> 100. `AtomicStampedReference` can: stamp 0 was now 2.
- A version column is the same stamp.

---

## When One Variable Is Not Enough

The package documentation states its own limit in its first sentence: *"A small toolkit of classes that support lock-free thread-safe programming on single variables."* **Single variables.**

Take a limiter: at most 10 requests per time window. It keeps two values — when the current window started, and how many requests it has let through. When a new window begins, both must change together.

With two `AtomicLong`s, each call is atomic and the decision is not. Several threads see the new window at about the same time, and each one sets the start and resets the count to zero. A reset that happens after other threads have already counted wipes their counts. The counting starts over, and more requests get through.

Eight threads send four requests each into the same window: 32 attempts, at most 10 should pass. Ten thousand windows, two of five runs, then the fix:

```
two-atomics over limit in 797/10000 windows, most 32
two-atomics over limit in 600/10000 windows, most 31
one-record  over limit in 0/10000 windows, most 10
```

`most 32` means that in at least one window every single request got through.

The fix puts both values in one immutable record and swaps the whole thing at once:

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

The same loop as the withdrawal: read, decide, compare-and-set, start over on failure. Both values change in one write, so no thread ever sees one without the other. Note the expected value is `w`, the reference that was read — the rule from the previous section. A new `Window` with the same fields would never match.

This works because building a `Window` is cheap and has no side effects. If the update is expensive, every failed attempt repeats it. If it has side effects, they repeat too. Then a small lock, as in the `synchronized` article, is the honest answer.

### In short

- Atomic classes protect one variable. Two fields that must change together are one decision.
- Two `AtomicLong`s let 600–797 of 10,000 windows go over a limit of 10, up to 32.
- One immutable record behind an `AtomicReference`: 0 windows over the limit, every run.
- If the update is expensive or has side effects, a small lock is the honest answer.

---

## Lock, Atomic, or Neither

- **One counter, few writers:** `AtomicInteger` or `AtomicLong`
- **One counter, many writers, read rarely:** `LongAdder`
- **Check, then write one value:** a `compareAndSet` loop, or `updateAndGet` with a pure function
- **Several values, one rule:** one immutable record in an `AtomicReference`, or a lock
- **Side effects in the update:** a lock

The `synchronized` article ended with *"The fastest lock is the one you did not take"*. That is still true, but the cost of the lock you did not take does not disappear. It moves into the loop: failed attempts, functions that run twice, contention that no thread dump shows.

Every compare-and-set loop in this article is a retry that only touches memory. The next article is about the retries that touch a database, a network and someone's money — and what makes running them twice safe.

### In short

- One value, one rule: an atomic class. Check then write: a compare-and-set loop.
- Hot counters: `LongAdder`, never for a value you check.
- Several values: one immutable record, or a lock.

---

## References

**API documentation**

- *java.util.concurrent.atomic — package summary.* The "single variables" sentence.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/package-summary.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/package-summary.html)
- *AtomicInteger* — `compareAndSet`, `getAndIncrement`, `updateAndGet` and the side-effect-free rule.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicInteger.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicInteger.html)
- *AtomicReference* — `compareAndSet` with `==`.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicReference.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicReference.html)
- *AtomicStampedReference* — a reference plus an integer stamp, updated together.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicStampedReference.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicStampedReference.html)
- *LongAdder* — the contention and memory trade-off, and `sum()` as a non-snapshot.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/LongAdder.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/LongAdder.html)
- *Integer.valueOf* — which boxed values are guaranteed to be shared.
  [https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)

**Further reading**

- Brian Goetz et al., *Java Concurrency in Practice*, chapter 15 — *Atomic Variables and Nonblocking Synchronization.*
- Martin Kleppmann and Chris Riccomini, *Designing Data-Intensive Applications*, 2nd edition, chapter 8 — conditional writes (compare-and-set).
