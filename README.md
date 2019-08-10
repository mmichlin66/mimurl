# Mimurl - URL Parsing and Matching
Mimurl library allows defining URL patterns and matching actual URLs against them. A patterns can either describe a full URL containing protocol, hostname, port, path, query and hash parts, or describe only a subset of the URL parts; for example, it can only describe a path. The URL pattern can define fields and when an actual URL matches the pattern, the result of the matching operation returns values of the fields; for example:

**URL pattern:** `{prot}://{host}.example.com:?{port%i}/departments/{dep}/*`

**Actual URL:** | **Matching result:**
:---|:---
`http://www.example.com:8080/departments/finance/payroll` | `{ prot: "http", port: 8080, dep: "finance" }`
`https://www.example.com/departments/hr` | `{ prot: "https", dep: "hr" }`


## Installation

```
npm install mimurl
```

## Usage
```typescript
import * as mimurl from "mimurl"

let pattern = "{prot}://{host}.example.com:?{port%i}/departments/{dep}/*";
let url = "http://www.example.com:8080/departments/finance/payroll";
let matchResult = mimurl.match( url, pattern);
if (matchResult.success)
{
    for( let fieldName in matchResult.fields)
        console.log( `${fieldName} = ${matchResults.fields[fieldName]}`);
}
else
    console.log( "The URL doesn't match the pattern");
```

## Features
Please refer to the following documents describing the mimurl library in more details:
* [About](https://mmichlin66.github.io/mimurl/mimurlAbout.html)
* [API Reference](https://mmichlin66.github.io/mimurl/mimurlReference.html)
* [Playground](https://mmichlin66.github.io/mimurl/mimurlDemo.html)

