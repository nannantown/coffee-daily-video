#!/usr/bin/env node
// Print the air date of the script being written now (YYYY-MM-DD, JST): today before noon, tomorrow from noon.
import { airDate } from "./content-format.mjs";
console.log(airDate());
