module.exports = {
    // api.php of the wiki to test on.
    api: "https://en.wikipedia.org/w/api.php",

    // The template to test. This must have a valid /sandbox subpage.
    template: "Split article",

    // The rate at which this script will test sandbox usage. We highly, HIGHLY suggest, that
    // you first check the transclusion count before setting this to `1` (100% of pages) or
    // any value that might account for a large amount of transclusions.
    rate: 0.01,

    // The number of threads to use. Doesn't mean actual threads, but determines the maximum
    // number of concurrent parse requests.
    concurrent: 4,

    // The delay in milliseconds to use between each request.
    delay: 250,
    
    // If set to an array, pages with this category will be marked as passing. If not found,
    // but not failing either (see failOnCategories), it will be a semi-pass.
    succeedOnCategories: false,
    
    // If set to an array, pages with this category will immediately fail if they are in this
    // category after the sandbox template is tested.
    failOnCategories: [ 
        "Pages with script errors" ,
        "Pages with split article errors"
    ]
};