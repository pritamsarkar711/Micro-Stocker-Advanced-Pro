# tar-compat (vendored override)

`@capacitor/cli` (v6) imports `tar` through tslib's `__importDefault` interop and
calls `require('tar').default.extract(...)`. The patched `tar` line (v7.x) exposes
named exports but no `.default`, which crashes `npx cap sync` with
`Cannot read properties of undefined (reading 'extract')`.

The root `package.json` overrides `tar` with this local package, which depends on
the genuine patched `npm:tar@7.5.23` and forwards its exports, adding the missing
`.default` binding. Keeping the shim means the dependency tree carries zero known
vulnerabilities (`npm audit` is clean) while the Capacitor CLI keeps working.

If `@capacitor/cli` is ever upgraded to a release that imports tar correctly, this
shim and the `tar` override can be deleted together.
