#pragma once
#include "lib/typedefs.h"
#include "lib/memory.h"

// A small JSON reader for the parts of a .vrm the engine's glTF parser skips
// (the VRM extensions and the harness's clip table in the root extras).
// Everything lives in the allocator passed to pjson_parse. Lookups on a
// missing key or index, or on the wrong kind of value, return NULL, so a
// chain of them reads like a path and fails softly.

typedef enum {
  PJSON_NULL,
  PJSON_BOOL,
  PJSON_NUMBER,
  PJSON_STRING,
  PJSON_ARRAY,
  PJSON_OBJECT,
} PJsonKind;

typedef struct PJson PJson;
struct PJson {
  PJsonKind kind;
  b32 boolean;
  f64 number;
  char *string;  // PJSON_STRING, NUL-terminated
  u32 count;     // PJSON_ARRAY, PJSON_OBJECT
  PJson *items;  // [count]
  char **keys;   // PJSON_OBJECT: [count]
};

// NULL on malformed input
PJson *pjson_parse(const char *text, u32 len, Allocator *alloc);

PJson *pjson_get(PJson *obj, const char *key);
PJson *pjson_at(PJson *arr, u32 index);
// the key of an object's index-th member; NULL for anything but an object
const char *pjson_key(PJson *obj, u32 index);
// a whole number in [0, count), else -1
i32 pjson_index(PJson *v, u32 count);
u32 pjson_count(PJson *v); // items of an array or object, else 0
f64 pjson_number(PJson *v, f64 fallback);
const char *pjson_string(PJson *v, const char *fallback);
b32 pjson_bool(PJson *v, b32 fallback);
