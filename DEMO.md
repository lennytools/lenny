# A gate that bites

This is a shortened receipt from the Codex install check. Lenny was copied into
a fresh repository with a deliberately incomplete helper:

```js
export function nextCounter(value) {
  return value + 1;
}
```

Before editing it, the generic council ran three blind seats in separate
ephemeral Codex processes. All three returned `NO-GO`. The correctness seat
reported:

> BLOCKER, confidence 1.0: invalid values are accepted without a clear error.
> `-1` becomes `0`, `1.5` becomes `2.5`, and `"1"` becomes `"11"`.
>
> BLOCKER, confidence 1.0: `Number.MAX_SAFE_INTEGER` increments to a value that
> is not a safe integer.
>
> HIGH, confidence 1.0: the self-check covers only two ordinary inputs, so it
> passes while both contract violations remain.

The conductor stopped the candidate, added native safe-integer and overflow
guards plus boundary checks, and reran the isolated council. Every seat then
returned `GO`; the Node self-check and the shipped evidence validator passed.

That is the point of Lenny's gates: a green smoke test did not get to overrule a
reproduced correctness failure.
