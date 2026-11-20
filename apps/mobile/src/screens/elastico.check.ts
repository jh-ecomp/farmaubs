/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import { ELASTICO_MAX, proximoElastico } from "./elastico.ts";

assert.equal(proximoElastico(0, -10, false), 0);
assert.equal(proximoElastico(0, -10, true), -3.5);
assert.equal(proximoElastico(-10, 10, true), -6.5);
assert.equal(proximoElastico(-ELASTICO_MAX, -40, true), -ELASTICO_MAX);
assert.equal(proximoElastico(-20, 0, false), 0);
