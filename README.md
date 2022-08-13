# MediaWiki Template Usage Sample Sandbox Substitution Tester
Tests template sandboxes by sampling template usages on MediaWiki wikis. Uses categories to determine successes and failures. Tests on a sample of real template usages, which can catch unexpected edge cases or usages.

Created after I got (rightly) [scolded by Primefac](https://en.wikipedia.org/w/index.php?diff=1104066591) for breaking a template. I wasn't able to find any tool that allowed me to check if I introduce widespread errors with a template change. Thus, this tool was made. This hopefully prevents the "change it and see what breaks" process that usually comes with template changes.

Written in a few hours. Don't expect it to be *good* good.

## Usage
Edit `config.js`. Documentation is provided. Run `npm run start` after.

## License
```
Copyright 2022 Chlod Aidan Alejandro

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```