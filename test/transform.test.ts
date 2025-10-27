// test/unit.transform.test.ts
import { transform } from "../src/transform";

it("renames in JS", () => {
  const input = "const foo = 1; console.log(foo)";
  const { code } = transform(input, { filename: "file.js", sourcemap: true });
  expect(code).toContain("const bar = 1");
  expect(code).toContain("console.log(bar)");
});

it("renames in TS", () => {
  const input = "const foo: number = 1 as number";
  const { code } = transform(input, { filename: "file.ts" });
  expect(code).toContain("bar");
  expect(code).not.toContain("foo");
});

it("preserves TypeScript type annotations", () => {
  const input = `
    interface FooInterface {
      foo: string;
      count: number;
    }
    
    const foo: FooInterface = { foo: "hello", count: 42 };
    function processFoo(param: FooInterface): string {
      return param.foo;
    }
    
    const result: string = processFoo(foo);
  `;
  
  const { code } = transform(input, { filename: "file.ts" });
  
  // Verify standalone "foo" is transformed to "bar"
  expect(code).toContain("bar");
  
  // Verify TypeScript syntax is preserved (identifiers like FooInterface remain unchanged)
  expect(code).toContain("interface FooInterface"); // FooInterface is NOT transformed (correct behavior)
  expect(code).toContain("bar: string"); // property foo becomes bar
  expect(code).toContain("count: number");
  expect(code).toContain("const bar: FooInterface"); // variable foo becomes bar
  expect(code).toContain("param: FooInterface");
  expect(code).toContain("return param.bar"); // property access foo becomes bar
  expect(code).toContain("): string");
  expect(code).toContain("const result: string");
  expect(code).toContain("processFoo(bar)"); // argument foo becomes bar
});

it("preserves complex TypeScript features", () => {
  const input = `
    type FooType<T> = T extends string ? string : number;
    const foo: FooType<string> = "test";
    const fooArray: Array<FooType<string>> = [foo];
  `;
  
  const { code } = transform(input, { filename: "file.ts" });
  
  // Verify transformation of standalone "foo" only
  expect(code).toContain("bar");
  
  // Verify TypeScript features are preserved (composite identifiers remain unchanged)
  expect(code).toContain("type FooType<T>"); // FooType is NOT transformed (correct behavior)
  expect(code).toContain("T extends string ? string : number");
  expect(code).toContain("const bar: FooType<string>"); // variable foo becomes bar
  expect(code).toContain("const fooArray: Array<FooType<string>>"); // fooArray is NOT transformed (correct behavior)
  expect(code).toContain("= [bar]"); // array element foo becomes bar
});
