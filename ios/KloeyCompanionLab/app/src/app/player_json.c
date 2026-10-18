#include "app/player_json.h"
#include "lib/string.h"

typedef struct {
  const char *s;
  u32 len;
  u32 at;
  Allocator *alloc;
  b32 failed;
} PJsonParser;

// one parsed child, kept on a list until its parent knows how many it has
typedef struct PJsonLink PJsonLink;
struct PJsonLink {
  PJson value;
  char *key;
  PJsonLink *next;
};

hz_internal void pjson_skip_ws(PJsonParser *p) {
  while (p->at < p->len) {
    char c = p->s[p->at];
    if (c != ' ' && c != '\t' && c != '\n' && c != '\r')
      return;
    p->at++;
  }
}

hz_internal b32 pjson_eat(PJsonParser *p, char c) {
  pjson_skip_ws(p);
  if (p->at < p->len && p->s[p->at] == c) {
    p->at++;
    return true;
  }
  return false;
}

hz_internal u32 pjson_utf8(char *out, u32 cp) {
  if (cp < 0x80) {
    out[0] = (char)cp;
    return 1;
  }
  if (cp < 0x800) {
    out[0] = (char)(0xC0 | (cp >> 6));
    out[1] = (char)(0x80 | (cp & 0x3F));
    return 2;
  }
  if (cp < 0x10000) {
    out[0] = (char)(0xE0 | (cp >> 12));
    out[1] = (char)(0x80 | ((cp >> 6) & 0x3F));
    out[2] = (char)(0x80 | (cp & 0x3F));
    return 3;
  }
  out[0] = (char)(0xF0 | (cp >> 18));
  out[1] = (char)(0x80 | ((cp >> 12) & 0x3F));
  out[2] = (char)(0x80 | ((cp >> 6) & 0x3F));
  out[3] = (char)(0x80 | (cp & 0x3F));
  return 4;
}

hz_internal u32 pjson_hex4(PJsonParser *p) {
  u32 v = 0;
  for (u32 i = 0; i < 4; i++) {
    char c = p->at < p->len ? p->s[p->at++] : 0;
    v <<= 4;
    if (c >= '0' && c <= '9')
      v |= (u32)(c - '0');
    else if (c >= 'a' && c <= 'f')
      v |= (u32)(c - 'a' + 10);
    else if (c >= 'A' && c <= 'F')
      v |= (u32)(c - 'A' + 10);
    else
      p->failed = true;
  }
  return v;
}

// the string at p->at (after its opening quote), unescaped
hz_internal char *pjson_string_body(PJsonParser *p) {
  // escapes only ever shrink, so the raw length is enough room
  u32 start = p->at;
  while (p->at < p->len && p->s[p->at] != '"') {
    if ((u8)p->s[p->at] < 0x20) {
      p->failed = true;
      return NULL;
    }
    p->at += p->s[p->at] == '\\' ? 2 : 1;
  }
  if (p->at >= p->len) {
    p->failed = true;
    return NULL;
  }
  u32 end = p->at++;
  char *out = ALLOC_ARRAY(p->alloc, char, end - start + 1);
  u32 n = 0;
  PJsonParser q = {p->s, end, start, p->alloc, false};
  while (q.at < end) {
    char c = q.s[q.at++];
    if (c != '\\') {
      out[n++] = c;
      continue;
    }
    char e = q.at < end ? q.s[q.at++] : 0;
    switch (e) {
    case 'n': out[n++] = '\n'; break;
    case 't': out[n++] = '\t'; break;
    case 'r': out[n++] = '\r'; break;
    case 'b': out[n++] = '\b'; break;
    case 'f': out[n++] = '\f'; break;
    case 'u': {
      u32 cp = pjson_hex4(&q);
      if (cp >= 0xD800 && cp < 0xDC00 && q.at + 6 <= end && q.s[q.at] == '\\' &&
          q.s[q.at + 1] == 'u') {
        q.at += 2;
        u32 lo = pjson_hex4(&q);
        cp = lo >= 0xDC00 && lo < 0xE000 ? 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00)
                                         : 0xFFFD;
      } else if (cp >= 0xD800 && cp < 0xE000) {
        cp = 0xFFFD;
      }
      if (cp == 0)
        q.failed = true;
      n += pjson_utf8(out + n, cp);
      break;
    }
    default: out[n++] = e; break;
    }
  }
  out[n] = 0;
  if (q.failed)
    p->failed = true;
  return out;
}

hz_internal f64 pjson_number_body(PJsonParser *p) {
  f64 sign = 1, v = 0;
  if (p->s[p->at] == '-') {
    sign = -1;
    p->at++;
  }
  if (p->at >= p->len || p->s[p->at] < '0' || p->s[p->at] > '9') {
    p->failed = true;
    return 0;
  }
  while (p->at < p->len && p->s[p->at] >= '0' && p->s[p->at] <= '9')
    v = v * 10 + (p->s[p->at++] - '0');
  if (p->at < p->len && p->s[p->at] == '.') {
    p->at++;
    f64 scale = 0.1;
    while (p->at < p->len && p->s[p->at] >= '0' && p->s[p->at] <= '9') {
      v += (p->s[p->at++] - '0') * scale;
      scale *= 0.1;
    }
  }
  if (p->at < p->len && (p->s[p->at] == 'e' || p->s[p->at] == 'E')) {
    p->at++;
    i32 esign = 1, e = 0;
    if (p->at < p->len && (p->s[p->at] == '+' || p->s[p->at] == '-'))
      esign = p->s[p->at++] == '-' ? -1 : 1;
    while (p->at < p->len && p->s[p->at] >= '0' && p->s[p->at] <= '9') {
      if (e < 400)
        e = e * 10 + (p->s[p->at] - '0');
      p->at++;
    }
    if (e > 400)
      e = 400;
    for (i32 i = 0; i < e; i++)
      v = esign > 0 ? v * 10 : v / 10;
  }
  return sign * v;
}

hz_internal b32 pjson_word(PJsonParser *p, const char *w) {
  u32 n = cstr_len(w);
  if (p->at + n > p->len || mem_cmp(p->s + p->at, w, n) != 0) {
    p->failed = true;
    return false;
  }
  p->at += n;
  return true;
}

hz_internal PJson pjson_value(PJsonParser *p, u32 depth);

// the children of an array or object, after its opening bracket
hz_internal PJson pjson_container(PJsonParser *p, b32 object, u32 depth) {
  PJson v = {.kind = object ? PJSON_OBJECT : PJSON_ARRAY};
  char close = object ? '}' : ']';
  PJsonLink *head = NULL, *tail = NULL;
  if (!pjson_eat(p, close)) {
    do {
      PJsonLink *l = ALLOC_ARRAY(p->alloc, PJsonLink, 1);
      if (object) {
        if (!pjson_eat(p, '"')) {
          p->failed = true;
          return v;
        }
        l->key = pjson_string_body(p);
        if (!pjson_eat(p, ':')) {
          p->failed = true;
          return v;
        }
      }
      l->value = pjson_value(p, depth + 1);
      if (p->failed)
        return v;
      if (tail)
        tail->next = l;
      else
        head = l;
      tail = l;
      v.count++;
    } while (pjson_eat(p, ','));
    if (!pjson_eat(p, close)) {
      p->failed = true;
      return v;
    }
  }
  v.items = ALLOC_ARRAY(p->alloc, PJson, v.count ? v.count : 1);
  if (object)
    v.keys = ALLOC_ARRAY(p->alloc, char *, v.count ? v.count : 1);
  u32 i = 0;
  for (PJsonLink *l = head; l; l = l->next, i++) {
    v.items[i] = l->value;
    if (object)
      v.keys[i] = l->key;
  }
  return v;
}

hz_internal PJson pjson_value(PJsonParser *p, u32 depth) {
  PJson v = {0};
  pjson_skip_ws(p);
  if (p->at >= p->len || depth > 256) {
    p->failed = true;
    return v;
  }
  char c = p->s[p->at];
  if (c == '{' || c == '[') {
    p->at++;
    return pjson_container(p, c == '{', depth);
  }
  if (c == '"') {
    p->at++;
    v.kind = PJSON_STRING;
    v.string = pjson_string_body(p);
    return v;
  }
  if (c == 't' || c == 'f') {
    v.kind = PJSON_BOOL;
    v.boolean = c == 't';
    pjson_word(p, c == 't' ? "true" : "false");
    return v;
  }
  if (c == 'n') {
    pjson_word(p, "null");
    return v;
  }
  if (c == '-' || (c >= '0' && c <= '9')) {
    v.kind = PJSON_NUMBER;
    v.number = pjson_number_body(p);
    return v;
  }
  p->failed = true;
  return v;
}

PJson *pjson_parse(const char *text, u32 len, Allocator *alloc) {
  PJsonParser p = {text, len, 0, alloc, false};
  PJson *root = ALLOC_ARRAY(alloc, PJson, 1);
  *root = pjson_value(&p, 0);
  pjson_skip_ws(&p);
  return p.failed || p.at < p.len ? NULL : root;
}

PJson *pjson_get(PJson *obj, const char *key) {
  if (!obj || obj->kind != PJSON_OBJECT)
    return NULL;
  for (u32 i = 0; i < obj->count; i++)
    if (cstr_equal(obj->keys[i], key))
      return &obj->items[i];
  return NULL;
}

PJson *pjson_at(PJson *arr, u32 index) {
  if (!arr || arr->kind != PJSON_ARRAY || index >= arr->count)
    return NULL;
  return &arr->items[index];
}

const char *pjson_key(PJson *obj, u32 index) {
  return obj && obj->kind == PJSON_OBJECT && index < obj->count ? obj->keys[index] : NULL;
}

i32 pjson_index(PJson *v, u32 count) {
  if (!v || v->kind != PJSON_NUMBER || v->number < 0 || v->number >= count)
    return -1;
  i32 i = (i32)v->number;
  return (f64)i == v->number ? i : -1;
}

u32 pjson_count(PJson *v) {
  return v && (v->kind == PJSON_ARRAY || v->kind == PJSON_OBJECT) ? v->count : 0;
}

f64 pjson_number(PJson *v, f64 fallback) {
  return v && v->kind == PJSON_NUMBER ? v->number : fallback;
}

const char *pjson_string(PJson *v, const char *fallback) {
  return v && v->kind == PJSON_STRING ? v->string : fallback;
}

b32 pjson_bool(PJson *v, b32 fallback) {
  return v && v->kind == PJSON_BOOL ? v->boolean : fallback;
}
