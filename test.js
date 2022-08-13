const OPERATOR = "User:Chlod; wiki@chlod.net";

// ========================================================

const axios = require('axios');
const chalk = require('chalk');
const crypto = require('crypto');

const Queue = require('./queue');
const config = require('./config');
const packageInfo = require('./package-lock.json');

// https://stackoverflow.com/a/9310752/6011166
function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function sha1(text) {
    const shasum = crypto.createHash('sha1');
    shasum.update(text);
    return shasum.digest('hex');
}

axios.defaults.headers.common['User-Agent'] = `mwtussst/${
    packageInfo.version
} (${OPERATOR}) axios/${
    packageInfo.packages["node_modules/axios"].version
}`;

(async () => {
    console.log(`${chalk.blueBright("[info]")} Starting test...`);

    const normalizedTitle = "Template:" + config.template[0].toUpperCase() + config.template.slice(1);

    // Get template redirects
    console.log(`${chalk.blueBright("[info]")} Getting redirects of "${normalizedTitle}"...`);
    const requestData = (await axios.post(config.api, new URLSearchParams({
        format: 'json',
        formatversion: 2,
        action: 'query',
        prop: 'linkshere',
        titles: normalizedTitle,
        lhprop: 'title',
        lhnamespace: 10, // Template:
        lhshow: 'redirect',
        lhlimit: 'max'
    }), {
        responsetype: "json"
    } )).data;
    const aliases = [
        normalizedTitle.replace(/^\s*Template:/g, ""),
         ...requestData.query.pages[0].linkshere.map(
            v => v.title.replace(/^\s*Template:/g, "")
        )
    ];
    console.log(`${chalk.blueBright("[info]")} Found redirects:`);
    aliases.forEach(v => {
        console.log(`${chalk.blueBright("[info]")} * Template:${v}`);
    })

    const aliasesRegexString = `(?:${
        aliases.map((v) => {
            if (/[A-Za-z]/.test(v[0])) {
                return `[${
                    v[0].toUpperCase()
                }${
                    v[0].toLowerCase()
                }]${
                    escapeRegExp(v.slice(1)).replace(/\\[ _]/g, "[ _]")
                }`;
            } else {
                return escapeRegExp(v.slice(1)).replace(/\\[ _]/g, "[ _]");
            }
        }).join("|")
    })`;

    console.log(`${chalk.blueBright("[info]")} Getting transclusions of "${config.template}"...`);   

    const foundPages = [];
    let eicontinue;
    do {
        console.log(`${chalk.gray("[dbug]")} Getting from API: eicontinue: ${eicontinue}`);
        const { data } = await axios.post(config.api, new URLSearchParams({
            format: "json",
            formatversion: 2,
            action: "query",
            list: "embeddedin",
            eititle: normalizedTitle,
            eilimit: "max",
            ...(eicontinue ? { eicontinue } : {})
        }), {
            responsetype: "json"
        });

        eicontinue = (data.continue || {}).eicontinue;
        foundPages.push(...data.query.embeddedin.map(v => v.title));

        console.log(`${chalk.yellow("[load]")} Found ${foundPages.length} pages...`);
    } while (eicontinue != null);

    console.log(`${chalk.blueBright("[info]")} Shuffling array...`);
    foundPages.sort(() => Math.sign((Math.random() - Math.random()) * 10));
    console.log(`${chalk.blueBright("[info]")} Sampling with a rate of ${config.rate * 100}%...`);

    // DEBUG
    const skipCount = Math.floor(foundPages.length / (foundPages.length * config.rate));
    // const skipCount = Math.floor(foundPages.length / 4);
    const pages = [];
    for ( let i = 0; i < foundPages.length; i += skipCount) {
        pages.push(foundPages[i]);
    }

    console.log(`${chalk.blueBright("[info]")} Sample size: ${pages.length}`);
    console.log(`${chalk.yellowBright("[warn]")} Starting tests...`);

    const queue = new Queue({
        delay: config.delay,
        concurrent: config.concurrent,
        autostart: true
    });
    const promises = [];

    for ( let i = 0; i < pages.length; i++ ) {
        const page = pages[i];
        promises.push(queue.submit(async () => {
            console.log(`${chalk.gray((i + 1) + "/" + pages.length)} Now testing: "${page}"...`);

            let wikitext = await axios.post(config.api, new URLSearchParams({
                format: "json",
                formatversion: 2,
                action: "query",
                titles: page,
                prop: "revisions",
                rvprop: "content",
                rvlimit: 1
            }), {
                responsetype: "json"
            }).then(({ data }) => {
                return data.query.pages[0].revisions[0].content;
            }, (e) => {
                console.log(`${chalk.red("[err!]")}`, e);
                return {
                    error: {
                        type: "network",
                        message: e.message,
                        error: e
                    },
                    page
                };
            }).catch((e) => {
                console.log(`${chalk.red("[err!]")}`, e);
                return {
                    error: {
                        type: "process",
                        message: e.message,
                        error: e
                    },
                    page
                };
            });
            const origWikitext = wikitext.slice(0);

            const replacer = new RegExp(
                "\\{\\{\\s*(?:\\:?[Tt]emplate:)?(" + aliasesRegexString + ")\\s*[|}]", "g"
            );

            wikitext = wikitext.replace(new RegExp(
                replacer.source, replacer.flags
            ), `{{${config.template}/sandbox|`);

            return await axios.post(config.api, new URLSearchParams({
                format: "json",
                formatversion: 2,
                action: "parse",
                title: page,
                text: wikitext,
                prop: "categories|templates"
            }), {
                responsetype: "json"
            }).then(({ data }) => {
                return data.parse;
            }, (e) => {
                console.log(`${chalk.red("[err!]")}`, e);
                return {
                    error: {
                        type: "network",
                        message: e.message,
                        error: e
                    },
                    page
                };
            }).then(({ categories, templates }) => {
                let status = "semifail";
                let info = null;

                const failingCats = [];
                if (status !== "fail") {
                    // Check if template is transcluded
                    if (!templates.some(v => v.title === normalizedTitle + "/sandbox")) {
                        // If the template can't be found, this is a failure.
                        status = "fail";
                        info = `Template "${normalizedTitle}/sandbox" not found in rendered page.`;
                    }
                }
                for (const cat of categories) {
                    if (
                        Array.isArray(config.failOnCategories) &&
                         config.failOnCategories.includes(cat.category.replace(/_/g, " "))
                    ) {
                        failingCats.push(cat.category);
                        status = "fail";
                        info = "Failing categories hit: [" + failingCats.join(", ") + "]"
                    }
                }
                if (status !== "fail") {
                    // Proceed to check for successes
                    if (Array.isArray(config.succeedOnCategories)) {
                        status = config.succeedOnCategories.every(successCat => {
                            const successCatDb = successCat.replace(/ /g, "_");
                            return categories.some(c => c === successCatDb)
                        }) ? "pass" : status;
                    } else {
                        status = "pass";
                    }
                }

                return {
                    error: false,
                    status,
                    page,
                    info,
                    hashes: {
                        old: sha1(origWikitext),
                        new: sha1(wikitext)
                    }
                }
            }, (e) => {
                console.log(`${chalk.red("[err!]")}`, e);
                return {
                    error: {
                        type: "parse",
                        message: e.message,
                        error: e
                    },
                    page
                };
            }).catch((e) => {
                console.log(`${chalk.red("[err!]")}`, e);
                return {
                    error: {
                        type: "process",
                        message: e.message,
                        error: e
                    },
                    page
                };
            });
        }).then(r => {
            console.log(`${
                {
                    error: chalk.red("[err!]"),
                    fail: chalk.redBright("[fail]"),
                    semifail: chalk.yellowBright("[smfl]"),
                    pass: chalk.greenBright("[pass]"),
                }[r.error ? "error" : r.status]
            } ${page}${r.status === "fail" ? ": " + r.info : ""}`);
            return r;
        }));
    }

    const results = await Promise.all(promises);
    queue.stop();

    const counts = {
        err: results.filter(v => v.error).length,
        fail: results.filter(v => v.status === "fail").length,
        semifail: results.filter(v => v.status === "semifail").length,
        pass: results.filter(v => v.status === "pass").length
    }

    console.log(`\n${chalk.blueBright("[info]")} TESTS COMPLETE\n`);
    console.log(`${chalk.blueBright("[info]")} ${
        counts.err
    } errored`);
    console.log(`${chalk.blueBright("[info]")} ${
        counts.fail
    } failed`);
    console.log(`${chalk.blueBright("[info]")} ${
        counts.semifail
    } semifailed`);
    console.log(`${chalk.blueBright("[info]")} ${
        counts.pass
    } passed`);

    console.log(`${chalk.blueBright("[info]")} ${
        ((counts.pass / (counts.fail + counts.pass + counts.semifail)) * 100)
            .toFixed(2)
    }% pass rate`);

    console.log("");

    console.log(`${chalk.blueBright("[info]")} Saving data to "results.json"...`);
    require("fs").writeFileSync("results.json", JSON.stringify(results, null, 4));
})();