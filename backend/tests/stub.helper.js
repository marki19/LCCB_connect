/**
 * Minimal dependency-free test double for a function on a module object.
 *
 * Why not a mocking library: this backend is CommonJS and is loaded natively by
 * `node --test`, so a stub installed on a required module's export object is
 * seen by every consumer of that module (they hold the same object reference).
 *
 *   const fn = stub(postModel, "getAllPosts", async () => []);
 *   fn.calls            // [[arg1, arg2], ...]
 *   fn.setImpl(fn)      // swap the behaviour mid-test
 *   fn.restore()        // put the original back
 */
function stub(object, name, impl) {
  const original = object[name];
  let current = impl || (() => undefined);

  const fn = function (...args) {
    fn.calls.push(args);
    return current.apply(this, args);
  };

  fn.calls = [];
  fn.setImpl = (next) => {
    current = next;
  };
  fn.restore = () => {
    object[name] = original;
  };

  object[name] = fn;
  return fn;
}

module.exports = { stub };
