Name: []

## Question 1

In the following code-snippet from `Num2Bits`, it looks like `sum_of_bits`
might be a sum of products of signals, making the subsequent constraint not
rank-1. Explain why `sum_of_bits` is actually a _linear combination_ of
signals.

```
        sum_of_bits += (2 ** i) * bits[i];
```

## Answer 1

Each bits[i] is an input, while each 2**i is a known number, ultimately a constant (powers of 2). Adding a constant times an input to a sum of constant times inputs generates a linear polynomial.
So overall, this is a linear combination of signals.

## Question 2

Explain, in your own words, the meaning of the `<==` operator.

## Answer 2

Combines an assignment of value to signal on the left side (<--) with an assertion / constraint (===). It not only assigns, but it enforces that all times the constraint holds.
This also "burns" the constraint into the circuit itself. It could be replaced with the 2 instructions separately and is overall safer than a simple assign.

## Question 3

Suppose you're reading a `circom` program and you see the following:

```
    signal input a;
    signal input b;
    signal input c;
    (a & 1) * b === c;
```

Explain why this is invalid.

## Answer 3

The bitwise operator that checks on the last bit (essentially showing if a number is odd or even) of a signal "a" is not linear/quadratic so not a proper component of a linear or quadratic expression.
(Multiplying it by another signal "b" does not fix it - can only use multiplication and addition of max quadratic signals to construct an assertion).
As such, the left side of the constraint is a non quadratic expression, which is not allowed to be used in R1CS assertions / constraints.
