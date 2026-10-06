import test from 'node:test';import assert from 'node:assert/strict';import {parseCompletionMetadata as parse} from './response-metadata.mjs';
test('完整流保存真实停止原因与用量',()=>{const x=parse('data: {"model":"m","choices":[{"delta":{"content":"正文"},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"finish_reason":"stop"}],"usage":{"completion_tokens":20}}\n\ndata: [DONE]\n\n');assert.equal(x.finishReasons[0].reason,'stop');assert.equal(x.usages[0].completion_tokens,20);assert.equal(x.truncated,false);assert.equal(x.doneSeen,true);});
test('达到输出上限单独标记',()=>{const x=parse('data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n');assert.equal(x.truncated,true);});
test('只有结束标记不能推定正常结束',()=>{const x=parse('data: [DONE]\n');assert.equal(x.finishReasonKnown,false);assert.equal(x.truncated,false);});
test('中断或坏帧不伪造结束原因',()=>{const x=parse('data: {"choices":');assert.equal(x.invalidFrames,1);assert.equal(x.finishReasonKnown,false);assert.equal(x.doneSeen,false);});
test('非流式响应也保存真实原因',()=>{assert.equal(parse('{"choices":[{"finish_reason":"stop"}]}').finishReasons[0].reason,'stop');});
