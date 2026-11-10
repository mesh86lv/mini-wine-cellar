// The shadcn CLI resolves `aliases.utils` from `components.json` whenever it adds a component, so
// this module has to exist; the components themselves import `cn` from the `cn` package directly.
export { cn } from "cn";
