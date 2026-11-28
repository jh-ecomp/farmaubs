/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import { alturaCobertaPeloTeclado } from "./teclado.ts";

assert.equal(alturaCobertaPeloTeclado(800, 848, { height: 0, screenY: 500 }), 348);
assert.equal(alturaCobertaPeloTeclado(800, 848, { height: 360, screenY: 500 }), 360);
assert.equal(alturaCobertaPeloTeclado(800, 848, { height: 0, screenY: 900 }), 0);
