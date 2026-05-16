---
name: schema
description: Define custom asset type schemas with typed properties. Use when the user wants to create or edit schemas, asset types, or structured data formats.
---

## Skill: Schema Builder

Define custom asset types (schemas) that add structured data formats to a project.

### Tools

- `schema__create_schema` — create or update a schema definition

### Reference

**Schema fields**:

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique ID, lowercase with underscores | `"character"` |
| `name` | Display name | `"Character"` |
| `extension` | File extension, starts with dot | `".char"` |
| `icon` | FontAwesome class | `"fa-solid fa-user"` |
| `thumbnail` | Dot-path to a property holding a file ID for the thumbnail, or `null` | `"references.front"` |
| `properties` | Typed fields (see below) | `{ name: { type: "string" } }` |
| `required` | Required property names | `["name"]` |

**Property types**:

| Type | Schema | Use for |
|------|--------|---------|
| Text | `{ "type": "string" }` | Names, descriptions |
| Number | `{ "type": "number" }` | Age, count, score |
| Boolean | `{ "type": "boolean" }` | Toggles, flags |
| String list | `{ "type": "array", "items": { "type": "string" } }` | Tags, keywords |
| Key-value map | `{ "type": "object", "additionalProperties": { "type": "string" } }` | Metadata pairs |

**Using schemas in apps**:
```js
const json = await ai.text({ prompt: "...", schema: "custom:character" });
const files = await file.list({ schema: "custom:character" });
```

### Example

```
schema__create_schema({
  id: "character",
  name: "Character",
  extension: ".char",
  icon: "fa-solid fa-user",
  thumbnail: "references.front",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    age: { type: "number" },
    tags: { type: "array", items: { type: "string" } },
    references: { type: "object", additionalProperties: { type: "string" } }
  },
  required: ["name"]
})
```
