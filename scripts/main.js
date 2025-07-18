class GURPSGrimoireModule {
  constructor() {
    this.isOpen = false;
    this._init();
  }

  static ID = 'gurps-grimoire';
  static instance = null;

  static initialize() {
    if (!GURPSGrimoireModule.instance) {
      GURPSGrimoireModule.instance = new GURPSGrimoireModule();
    }
    return GURPSGrimoireModule.instance;
  }

  /**
   * Initialize the module
   */
  _init() {
    // Initialize when ready
    Hooks.once('ready', () => {
      this._exposeAPI();
    });
  }

  /**
   * Expose API for macros and external access
   */
  _exposeAPI() {
    // Expose on the module
    const module = game.modules.get(GURPSGrimoireModule.ID);
    if (module) {
      module.api = {
        openGrimoire: (actor) => this.openGrimoire(actor),
        getInstance: () => this
      };
    }

    // Also expose globally for easier macro access
    window.gurpsGrimoire = {
      open: (actor) => this.openGrimoire(actor),
      getInstance: () => this
    };

    // And on the game object
    game.gurpsGrimoire = {
      open: (actor) => this.openGrimoire(actor),
      getInstance: () => this
    };

    console.log('GURPS Grimoire Module API exposed successfully');
  }

  /**
   * Open the grimoire for a specific actor
   * @param {Actor} actor - The actor to show spells for
   */
  openGrimoire(actor = null) {
    // Use provided actor or try to get from GURPS.LastActor or selected token
    const targetActor = actor || 
                       (typeof GURPS !== 'undefined' ? GURPS.LastActor : null) || 
                       (canvas.tokens.controlled.length > 0 ? canvas.tokens.controlled[0].actor : null);

    if (!targetActor) {
      ui.notifications.warn('No actor selected. Please select a token or character.');
      return;
    }

    if (!targetActor.system.spells) {
      ui.notifications.warn('This actor has no spells available.');
      return;
    }

    this._showGrimoireDialog(targetActor);
  }

  /**
   * Show the main grimoire dialog
   */
  _showGrimoireDialog(actor) {
    const myContent = `
      <div class="gurps-grimoire-dialog">
        <div class="skill-chooser">
          <!-- Search Section -->
          <div class="search-section">
            <input type="text" id="spell-search" class="search-input" placeholder="Search for a spell...">
            <div class="skill-count" id="spell-count">Showing 0 of 0 spells</div>
          </div>
          
          <!-- Spells Table -->
          <div class="spells-table-container">
            <table class="spells-table">
              <thead>
                <tr>
                  <th>Spells</th>
                  <th>Class</th>
                  <th>College</th>
                  <th>Cost</th>
                  <th>Maintain</th>
                  <th>Casting Time</th>
                  <th>Duration</th>
                  <th>SL</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody id="spell-table-body">
              </tbody>
            </table>
          </div>
          
          <!-- Help Text -->
          <div class="help-text">
            <p><i class="fas fa-info-circle"></i> All spell details are displayed in the table above</p>
          </div>
        </div>
      </div>`;

    new Dialog({
      title: "GURPS Grimoire",
      content: myContent,
      buttons: {},
      render: async (html) => this._bindGrimoireEvents(html, actor)
    }, {
        resizable: true,
        classes: ["gurps-grimoire-dialog"],
        width: 1000,
        height: 600
    }).render(true);

    this.isOpen = true;
  }

  /**
   * Bind events to the grimoire dialog
   */
  _bindGrimoireEvents(html, actor) {
    let spellSearch = html.find("#spell-search");
    let spellTableBody = html.find("#spell-table-body");
    let spellCount = html.find("#spell-count");
    const spells = this._getAllSpells(actor.system.spells);

    // Update spell count
    const updateSpellCount = (filtered, total) => {
      spellCount.text(`Showing ${filtered} of ${total} spells`);
    };

    spellSearch.on("input", (event) => {
      const searchText = event.target.value.toLowerCase();

      if (searchText.length === 0) {
        // Show all spells when no search text
        this._updateSpellTable(spellTableBody, spells);
        updateSpellCount(spells.length, spells.length);
      } else {
        const filteredSpells = spells.filter((spell) =>
          spell.name.toLowerCase().includes(searchText)
        );
        // Show all filtered spells
        this._updateSpellTable(spellTableBody, filteredSpells);
        updateSpellCount(filteredSpells.length, spells.length);
      }
    });

    // Add click handler for pdflink spans
    spellTableBody.on("click", ".pdflink", (event) => {
      event.preventDefault();
      const pageref = $(event.target).text();
      if (pageref && typeof GURPS !== 'undefined' && GURPS.executeOTF) {
        GURPS.executeOTF(`[PDF:${pageref}]`);
      }
    });

    // Initial display - show all spells
    this._updateSpellTable(spellTableBody, spells);
    updateSpellCount(spells.length, spells.length);
  }

  /**
   * Update spell table
   */
  _updateSpellTable(spellTableBody, filteredSpells) {
    spellTableBody.empty();

    if (filteredSpells.length === 0) {
      spellTableBody.append('<tr><td colspan="9" class="no-results">No spells found</td></tr>');
      return;
    }

    for (const spell of filteredSpells) {
      const spellRow = this._createSpellTableRow(spell);
      spellTableBody.append(spellRow);
    }
  }

  /**
   * Create a table row for a spell
   */
  _createSpellTableRow(spell) {
    const {
      name,
      class: spellClass,
      college,
      cost,
      maintain,
      casttime,
      duration,
      level,
      pageref,
    } = spell;

    return `
      <tr class="spell-row" data-spell-name="${name}">
        <td class="spell-name">${name || '-'}</td>
        <td class="spell-class">${spellClass || '-'}</td>
        <td class="spell-college">${college || '-'}</td>
        <td class="spell-cost">${cost || '-'}</td>
        <td class="spell-maintain">${maintain || '-'}</td>
        <td class="spell-casttime">${casttime || '-'}</td>
        <td class="spell-duration">${duration || '-'}</td>
        <td class="spell-level">${level || '-'}</td>
        <td class="spell-pageref">${pageref ? `<span class="pdflink">${pageref}</span>` : '-'}</td>
      </tr>`;
  }

  /**
   * Get all spells from the actor's spell structure
   */
  _getAllSpells(spells) {
    const allSpells = [];

    function traverseSpells(spells) {
      for (const key in spells) {
        if (spells.hasOwnProperty(key)) {
          const spell = spells[key];
          allSpells.push(spell);

          if (spell.contains) {
            traverseSpells(spell.contains);
          }
        }
      }
    }

    traverseSpells(spells);

    return allSpells;
  }
}

// Initialize module when Foundry is ready
Hooks.once('init', GURPSGrimoireModule.initialize);