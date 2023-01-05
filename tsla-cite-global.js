var global = global || window;
pathArray = window.location.pathname.split("/");
collAlias = pathArray[3];
itemID = pathArray[5];

const mappings = {
  Title: "itemTitle",
  order: 0,
  Creator: "itemCreator",
  order: 1,
  Date: "itemDate",
  order: 2,
  "Collection Name": "itemCollection",
  order: 3,
  "Storage Location": "itemStorage",
  order: 4,
  "ID#": "itemID",
  order: 5,
  "Owning Institution": "itemOwning",
  order: 6,
  Repository: "itemRepository",
  order: 7,
};

// helper function to determine parent record ID of current item
function getParent(item, collection) {
  return (
    fetch(
      `/digital/bl/dmwebservices/index.php?q=GetParent/${collection}/${item}/json`
    )
      .then((response) => response.json())
      // make GetParent API call and return as JSON
      .then((json) => {
        let parent = false;
        // parse JSON for 'parent' value; -1 indicates parent ID is the same as item ID
        if (json.parent === -1) {
          parent = item;
        } else {
          parent = json.parent;
        }
        return parent;
      })
      .then((parent) => {
        // once parent is known, check if IIIF Pres manifest exists
        return fetch(`/iiif/info/${collection}/${parent}/manifest.json`)
          .then((response) => {
            if (response.status != 200) {
              console.log("No IIIF manifest exists for this record.");
              parent = false;
              // if no manifest exists, return is 'false' so that IIIF button is not inserted
              return parent;
            } else {
              // check if manifest is for single-item PDF
              return fetch(
                `/digital/api/collections/${collection}/items/${parent}/false`
              )
                .then((response) => response.json())
                .then((json) => {
                  if (json.filename.split(".").pop() === "pdf") {
                    // if item format is pdf return is false so that IIIF button is not inserted
                    console.log("pdf?", json.filename.split(".").pop());
                    parent = false;
                    return parent;
                  } else {
                    return parent;
                  }
                })
                .catch((error) =>
                  console.log("Item API request failed.", error)
                );
            }
          })
          .catch((error) => {
            console.log("Manifest request failed.", error);
            parent = false;
            return parent;
          });
      })
      .catch(function (error) {
        console.log("GetParent request failed.", error);
        parent = false;
        return parent;
      })
  );
}

//API call
async function buildMetadataObject(collAlias, itemID) {
  let response = await fetch(
    "https://teva.contentdm.oclc.org/iiif/info/" +
      global.collAlias +
      "/" +
      global.itemID +
      "/manifest.json"
  );
  let data = await response.json();
  return data.metadata.reduce(
    (acc, { label, value }) => ({ ...acc, [mappings[label]]: value }),
    {}
  );
}

//create citation, ignoring undefined or null values
function insertCitation(data) {
  var tTitle = data.itemTitle;
  var url =
    "https://teva.contentdm.oclc.org/digital/collection/" +
    global.collAlias +
    "/id/" +
    global.itemID;
  var dateToday = new Date().toISOString().slice(0, 10);
  const fieldBlackList = ["itemTitle"];
  const itemCite = `<hr /><strong>Citation:</strong> \n "${
    data.itemTitle
  }," ${Object.values(mappings)
    .reduce((acc, cur) => {
      if (fieldBlackList.includes(cur)) return acc;
      const value = data[cur];
      return value ? [...acc, value] : acc;
    }, [])
    .join(
      ", "
    )}, ${url}, accessed ${dateToday}. <br>Note: This citation is auto-generated and may be incomplete. Check your preferred style guide or the <a href="https://teva.contentdm.oclc.org/customizations/global/pages/about.html">About TeVA page</a> for more information.`;
  const citationContainer = document.createElement("div");
  citationContainer.id = "citation";
  citationContainer.innerHTML = itemCite;
  if (tTitle) {
    document
      .querySelector(".ItemView-itemViewContainer")
      .appendChild(citationContainer);
  }
}

//print citation to page
(async () => {
  document.addEventListener("cdm-item-page:ready", async function (e) {
    const citationData = await buildMetadataObject();
    insertCitation(citationData);
  });
  document.addEventListener("cdm-item-page:update", async function (e) {
    document.getElementById("citation").remove();
    const citationData = await buildMetadataObject();
    insertCitation(citationData);
  });
})();
