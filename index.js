const xlsx = require('xlsx');
const fs = require('fs');
const { group } = require('console');

// Load the Excel file
const filePath = 'tempResult.xlsx';  // Replace with your actual file path
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Fonction pour lire le fichier JSON
function readJSONFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (parseErr) {
                    reject(parseErr);
                }
            }
        });
    });
}




async function main() {

    // Fonction pour transformer un tableau en JSON avec les valeurs uniques et leurs occurrences
    function arrayToJsonWithOccurrences(array) {
        const occurrences = {};


        array.forEach(item => {
    
            if (occurrences[item]) {
                occurrences[item]++;
            } else {
                occurrences[item] = 1;
            }
        });
        return occurrences
    }

    // load json
    const correspondance = await readJSONFile("correspondance.json");
    const scenarios = await readJSONFile("scenarios.json");
    // Convert the sheet to JSON
    const jsonData = xlsx.utils.sheet_to_json(sheet, { defval: "" });



    scenarios.scenarios.forEach(s => {
        console.log("Scenario : " + s.name)
        console.log("------------------------------------------------")
        let constituencies = {};
        let parties = []
        let duels= []
        let tri = []
        let totalVote = 0;
        let circonscriptions = [];
        // Iterate through each row and construct the constituencies object
        jsonData.forEach(row => {
            const constituencyCode = row['Code circonscription législative'];
            const constituencyName = row['Libellé circonscription législative'];
            const label = row['Libellé département'] + ' ' + row['Libellé circonscription législative'];
            totalVote += row['Votants'];

            const circonscription = {
                name: constituencyName,
                label: label,
                results: []
            };


            for (let i = 1; i <= 38; i++) {  // Assuming there are 38 possible parties
                const partyVotes = row[`Voix ${i}`];
                if (partyVotes > 0) {
                    const partyName = correspondance[row[`Libellé de liste ${i}`]];
                    const partyCode = row[`Numéro de panneau ${i}`];
                    const percentageVotes = row[`% Voix/exprimés ${i}`];

                    circonscription.results.push({
                        party_code: partyCode,
                        party_name: partyName,
                        votes: partyVotes,
                        percentage_votes: percentageVotes
                    });

                    // Add the party to the global list of parties
                    if (!parties[partyCode]) {
                        parties[partyCode] = {
                            code: partyCode,
                            name: partyName,
                            voix: partyVotes
                        };
                    } else {
                        parties[partyCode].voix += partyVotes;
                    }
                }
            }
            circonscription.legislatives = { "1er": [], "2e": [] }
    
                // 1er Tour
                s.groupement.forEach(groupe => {
                    let voteGroup = 0;
                    groupe.regroupement.forEach(r => {
                        voteGroup += circonscription.results.find(res => res.party_name === r.name).votes * r.ratio
                    })
                    groupe.vote = voteGroup

                    circonscription.legislatives["1er"].push({
                        name: groupe.name,
                        vote: groupe.vote,
                        "vote%": Math.round(voteGroup / row["Exprimés"] * 100, 1),
                        "vote%inscrits": Math.round(voteGroup / row["Inscrits"] * 100, 1)
                    })

                    // Victoire 1er tour
                    if (voteGroup > row["Exprimés"] / 2) {
                        //console.log(`Winner : ${groupe.name} in ${circonscription.label}`)
                        circonscription.legislatives.winner = groupe.name
                    }
                    // Present 2e tour
                    if (voteGroup > row["Inscrits"] * 12.5 / 100) {
                        circonscription.legislatives["2e"].push({
                            name: groupe.name,
                            vote: groupe.vote,
                            "vote%": Math.round(voteGroup / row["Exprimés"] * 100, 1),
                            "vote%inscrits": Math.round(voteGroup / row["Inscrits"] * 100, 1)
                        })
                    }
                })
                circonscription.legislatives["1er"].sort((a, b) => b.vote - a.vote)


                if(circonscription.legislatives.winner) {
                    circonscription.legislatives["2e"]= [circonscription.legislatives["1er"][0]]
                } else if (circonscription.legislatives["2e"].length == 0 ) {
                    circonscription.legislatives["2e"].push(circonscription.legislatives["1er"][0])
                    circonscription.legislatives["2e"].push(circonscription.legislatives["1er"][1])
                } else if (circonscription.legislatives["2e"].length == 1) {
                    circonscription.legislatives["2e"].push(circonscription.legislatives["1er"][1])
                }

                circonscription.legislatives["2e"].sort((a, b) => b.vote - a.vote)
                if(circonscription.legislatives["2e"].length > 2) tri.push(circonscription.legislatives["2e"][0])
                circonscription.legislatives["2e"].sort((a, b) => b.name.localeCompare(a.name))
            
                let duel = circonscription.legislatives["2e"].map(p => p.name).join(" vs ")
                duels.push(duel)


                // 2e tour
                if(s[duel]) {
                    let totalVote = 0;
                    circonscription.legislatives["2e"] = []
                    s[duel].forEach(groupe => {
                        let voteGroup = 0;
                        groupe.regroupement.forEach(r => {
                            voteGroup += circonscription.results.find(res => res.party_name === r.name).votes * r.ratio
                        })
                        totalVote += voteGroup
                    })

                    s[duel].forEach(groupe => {
                        let voteGroup = 0;
                        groupe.regroupement.forEach(r => {
                            voteGroup += circonscription.results.find(res => res.party_name === r.name).votes * r.ratio
                        })
                        circonscription.legislatives["2e"].push({
                            name: groupe.name,
                            vote: voteGroup,
                            "vote%": Math.round(voteGroup / totalVote * 100, 1),
                        })
                    })


                    circonscription.legislatives["2e"].sort((a, b) => b.vote - a.vote)
                    circonscription.legislatives.winner = circonscription.legislatives["2e"][0].name



                } else if(circonscription.legislatives["2e"].length > 1){
                    console.log(duel)

                }

            circonscriptions.push(circonscription)
            constituencies[constituencyCode] = circonscription;

        });



        parties.sort((a, b) => b.voix - a.voix)
        console.log(totalVote)
        partiesFiltered = parties.filter((party, index) => party.voix > totalVote * 0.005);


        console.log("3e et éliminé")
        console.table(arrayToJsonWithOccurrences(circonscriptions.filter(c => c.legislatives["2e"].length < 3).map(c => c.legislatives["1er"][2].name)))

        console.log("En tete dans les triangulaires")
        console.table(arrayToJsonWithOccurrences(tri.map(c => c.name)))

        console.log("2e tour")
        console.table(arrayToJsonWithOccurrences(duels))


        console.log("Resultats 2e tour")

        console.log("Vainqueur de Triangulaires")
        console.table(arrayToJsonWithOccurrences(circonscriptions.filter(c => c.legislatives["2e"].length > 2).map(c => c.legislatives["2e"][0].name)))


        console.table(arrayToJsonWithOccurrences(circonscriptions.map(c => c.legislatives.winner)))
        // Write the result to a JSON file
        const output = {
            partiesFiltered,
            constituencies,
        };


        fs.writeFileSync('constituencies_and_parties_results.json', JSON.stringify(output, null, 2), 'utf8');
        console.log('Data has been written to constituencies_and_parties_results.json');
    })
}

main()