import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const bundle = await build({entryPoints: [new URL('../src/theme.ts', import.meta.url).pathname], bundle:true, platform:'node', format:'cjs',write:false})
const context = {module:{exports:{}},exports:{},require:createRequire(import.meta.url)}
context.exports=context.module.exports
vm.runInNewContext(bundle.outputFiles[0].text,context)
const {readTheme,saveTheme,applyTheme,THEME_KEY}=context.module.exports
 test('theme defaults light, accepts only exact modes, and survives inaccessible storage',()=>{
 assert.equal(THEME_KEY,'skillmarket-hero-theme')
 for(const value of [null,'system','LIGHT','',undefined]) assert.equal(readTheme(()=>({getItem:()=>value})),'light')
 for(const value of ['light','dark']) assert.equal(readTheme(()=>({getItem:()=>value})),value)
 assert.equal(readTheme(()=>{throw new Error('SecurityError')}),'light')
 assert.equal(readTheme(()=>({getItem(){throw new Error('SecurityError')}})),'light')
 assert.equal(saveTheme('dark',()=>({setItem(){throw new Error('QuotaExceededError')}})),false)
 const values = new Map(); const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
 assert.equal(saveTheme('dark',()=>storage),true)
 assert.equal(readTheme(()=>storage),'dark')
 const classes=new Set(['light']);const root={classList:{remove:(...v)=>v.forEach(x=>classes.delete(x)),add:v=>classes.add(v)},dataset:{}}
 applyTheme('dark',root);assert.deepEqual([...classes],['dark']);assert.equal(root.dataset.theme,'dark')
})
