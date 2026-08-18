//#region src/index.ts
/**
* Theme toggle plugin, node half. Pure surface plugin: the empty apply exists
* so the plugin appears in the host Loader; the browser half ships through the
* package.json `dsh.client` declaration and is served at runtime.
*/
/** Host plugin body — no host-side behavior for this surface plugin. */
function apply() {}
//#endregion
export { apply };
