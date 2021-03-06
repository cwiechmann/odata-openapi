#!/usr/bin/env node

/* TODO:
- glob for source file patterns   
- arguments for
     - info-title/description/version?
     - externalDocs-url/description?
*/
//console.dir(argv);

'use strict';

var xslt4node = require('xslt4node');
var minimist = require('minimist');
var path = require('path');
var fs = require('fs');

var xsltpath = path.dirname(require.main.filename) + path.sep;
//xslt4node.addLibrary(xsltpath + 'xalan.jar');

var unknown = false;

var argv = minimist(process.argv.slice(2), {
    string: ["o", "openapi-version", "u", "swagger-ui", "v", "odata-version", "scheme", "host", "basePath"],
    boolean: ["d", "diagram", "h", "help", "p", "pretty", "r", "references"],
    alias: {
        d: "diagram",
        h: "help",
        o: "openapi-version",
        p: "pretty",
        r: "references",
        u: "swagger-ui",
        v: "odata-version"
    },
    default: {
        basePath: "/service-root",
        diagram: false,
        host: "localhost",
        "odata-version": "4.0",
        "openapi-version": "3.0.0",
        pretty: false,
        references: false,
        scheme: "http",
        "swagger-ui": "http://petstore.swagger.io"
    },
    unknown: (arg) => {
        if (arg.substring(0, 1) == '-') {
            console.error('Unknown option: ' + arg);
            unknown = true;
            return false;
        }
    }
});
if (argv.o == '2') argv.o = "2.0";
if (argv.o == '3') argv.o = "3.0.0";

if (unknown || argv._.length == 0 || argv.h) {
    console.log('Usage: ' + path.basename(process.argv[1]) + ` <options> <source files>
Options:
 --basePath              base path (default: /service-root)
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -o, --openapi-version   3.0.0 or 2.0 (default: 3.0.0)
 -p, --pretty            pretty-print JSON result
 -r, --references        include references to other files
 --scheme                scheme (default: http)
 -u, --swagger-ui        URL of Swagger UI for cross-service references`);
} else {
    for (var i = 0; i < argv._.length; i++) {
        transform(argv._[i]);
    }
}

function transform(source) {
    if (!fs.existsSync(source)) {
        console.error('Source file not found: ' + source);
        return;
    }

    xslt4node.transform(
        {
            xsltPath: xsltpath + 'OData-Version.xsl',
            sourcePath: source,
            result: String
        },
        (err, result) => {
            if (err) {
                console.error('Source file not XML: ' + source);
            } else if (result == "") {
                console.error('Source file not OData: ' + source);
            } else if (result == "2.0" || result == "3.0") {
                transformV2V3(source, result);
            } else {
                transformV4(source, "4.0", false);
            }
        }
    );
}

function transformV2V3(source, version) {
    var target = source.substring(0, source.lastIndexOf('.') + 1) + 'tmp';
    xslt4node.transform(
        {
            xsltPath: xsltpath + 'V2-to-V4-CSDL.xsl',
            sourcePath: source,
            result: target
        },
        (err, result) => {
            if (err) {
                console.error(err);
            } else {
                transformV4(target, version, true);
            }
        }
    );
}

function transformV4(source, version, deleteSource) {
    var target = source.substring(0, source.lastIndexOf('.') + 1) + 'openapi.json';
    xslt4node.transform(
        {
            xsltPath: xsltpath + 'V4-CSDL-to-OpenAPI.xsl',
            sourcePath: source,
            result: (argv.pretty ? Buffer : target),
            params: {
                basePath: argv.basePath,
                diagram: argv.diagram,
                host: argv.host,
                "odata-version": version,
                "openapi-version": argv.o,
                references: argv.references,
                scheme: argv.scheme,
                "swagger-ui": argv.u
            }
        },
        (err, result) => {
            if (err) {
                console.error(err);
            } else {
                if (argv.pretty)
                    fs.writeFileSync(target, JSON.stringify(JSON.parse(result), null, 4));
                if (deleteSource)
                    fs.unlink(source, (err) => { if (err) console.error(err); });
            }
        }
    );
}