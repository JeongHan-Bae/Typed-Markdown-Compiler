/**
 * Target-independent code generator contract.
 *
 * A generator consumes a typed IR and produces one concrete target. The Vue
 * implementation is only one implementation of this contract.
 */
export interface CodeGenerator<Input, Output> {
  generate(input: Input): Output;
}
