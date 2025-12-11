import { camelCase, transform, unescape } from "lodash";
import { parse } from "csv-parse/sync";
import { transform as transformData } from "stream-transform";
import { parseBooleans, stripPrefix } from "xml2js/lib/processors";
import xml2js from "xml2js";

import { TSV_IGNORE_FIELDS } from "./constants";

const parseString = (xml, params) =>
  new Promise((resolve, reject) => {
    xml2js.parseString(xml, params, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });

const genericParser = (objValue, objKey) => {
  let value = unescape(objValue);

  const lowerCaseKey = objKey.toLowerCase();
  const ignore = TSV_IGNORE_FIELDS.indexOf(lowerCaseKey) > -1;
  if (!ignore) {
    const isInt = (str) => /^(\-|\+)?([1-9]+[0-9]*)$/.test(str);
    const isFloat = (v) => v - parseFloat(v) + 1 >= 0;

    if (isInt(value)) {
      value = parseInt(value, 10);
    } else if (isFloat(value)) {
      value = parseFloat(value);
    } else {
      value = parseBooleans(objValue, objKey);
    }
  }

  return value;
};

const trimComma = (str) => str.replace(new RegExp("^,*"), "");

const parseXML = (xml) =>
  parseString(xml, {
    explicitArray: false,
    explicitRoot: false,
    trim: true,
    mergeAttrs: true,
    charkey: "value",
    valueProcessors: [trimComma, genericParser],
    tagNameProcessors: [stripPrefix, camelCase],
    attrValueProcessors: [genericParser],
    attrNameProcessors: [stripPrefix, camelCase],
  });

const parseTSV = (tsv) => {
  const json = parse(tsv, {
    relax: true,
    delimiter: "\t",
    quote: "",
    skip_empty_lines: false,
    columns: header => header.map(column => camelCase(column))
  });
  const handler = (data) =>
    transform(data, (result, value, key) => {
      result[key] = value;
    });

    return new Promise((resolve, reject) => {
      const data = [];
      transformData(json, handler)
      .on("data", (row) => {
        data.push(row);
      })
      .on("error", (e) => {
        console.log("🚀 ~ parseTSV ~ error:", error)
        reject(e);
      })
      .on("end", () => {
        resolve(data);
      });
  });
};

export { parseXML, parseTSV };
