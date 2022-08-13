const axios = require('axios');
const chalk = require('chalk');

const Queue = require('../queue');
const config = require('../config');

(async () => {
    console.log(`${chalk.blueBright("[info]")} Starting test...`);
    console.log(`${chalk.blueBright("[info]")} Getting transclusions of "${config.template}"...`);

    const foundPages = [];
    let eicontinue;
    do {
        const { data } = await axios.get(config.api, {
            params: {
                format: "json",
                formatversion: 2,
                action: "query",
                list: "embeddedin",
                eititle: config.template,
                eilimit: "max",
            },
            responsetype: "json"
        });

        eicontinue = (data.continue || {}).eicontinue;
        foundPages.push(...data.query.embeddedin.map(v => v.title));

        console.log(`${chalk.yellow("[load]")} Found ${foundPages.length} pages...`);
    } while (eicontinue != null);

    console.log(`${chalk.blueBright("[info]")} Shuffling array...`);
    foundPages.sort(() => Math.sign((Math.random() - Math.random()) * 10));
    console.log(`${chalk.blueBright("[info]")} Sampling with a rate of ${config.rate * 100}%...`);

    const skipCount = Math.floor(foundPages.length / (foundPages.length * config.rate));
    const pages = [];
    for ( let i = 0; i < foundPages.length; i += skipCount) {
        pages.push(foundPages[i]);
    }

    console.log(`${chalk.blueBright("[info]")} Sample size: ${pages.length}%...`);
    console.log(`${chalk.yellowBright("[warn]")} Starting tests...`);

    const queue = new Queue({
        delay: config.delay,
        concurrent: config.concurrent,
        autostart: true
    });
    const results = [];

    for ( let i = 0; i < pages.length; i++ ) {
        const page = pages[i];
        queue.submit(function ( i, page ) {
            console.log(`${chalk.gray(i + "/" + pages.length)} Now testing: "${page}"...`);
            
            const wikitext = await axios.get(config.api, {
                params: {
                    format: "json",
                    formatversion: 2,
                    action: "query",
                    titles: page,
                    prop: "revisions",
                    rvprop: "content",
                    rvlimit: 1
                },
                responsetype: "json"
            }).then(({ data }) => {
                return data.query.pages[0].revisions[0].content;
            }, (e) => {
                console.log(`${chalk.red("[err!]")} ${e}`);
                results.push({
                    error: {
                        type: "network",
                        message: e.message,
                    }
                })
            }).catch((e) => {
                console.log(`${chalk.red("[err!]")} ${e}`);
                results.push({
                    error: {
                        type: "process",
                        message: e.message,
                    }
                })
            });

            // Parse wikitext and identify categories
        }, [i, page]);
    }

    console.log(`${chalk.yellowBright("[info]")} Saving data to "results.json"...`);
    require("fs").writeFileSync("results.json", JSON.stringify(results, null, 4));
})();