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
   * Show the main grimoire dialog - simplified version
   */
  _showGrimoireDialog(actor) {
    const spells = this._getAllSpells(actor.system.spells);
    const spellCount = spells.length;

    const myContent = `
      <div class="skill-chooser">
        <div class="search-section">
          <input type="text" id="spell-search" class="search-input" placeholder="Type to filter spells...">
          <div class="skill-count">${spellCount} spells</div>
        </div>
        
        <div class="skills-list" id="spell-list"></div>
        
        <div class="help-text">
          <p><i class="fas fa-info-circle"></i> Simple spell reference list</p>
        </div>
      </div>`;

    new Dialog({
      title: "GURPS Grimoire",
      content: myContent,
      buttons: {
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: "Close",
          callback: () => {}
        }
      },
      render: async (html) => this._bindGrimoireEvents(html, actor),
      close: () => { this.isOpen = false; }
    }, {
        width: 520, 
        height: 600,
        resizable: true,
        classes: ["gurps-grimoire-dialog"]
    }).render(true);

    this.isOpen = true;
  }

  /**
   * Bind events to the grimoire dialog
   */
  _bindGrimoireEvents(html, actor) {
    let spellSearch = html.find("#spell-search");
    let spellList = html.find("#spell-list");
    
    const spells = this._getAllSpells(actor.system.spells);

    spellSearch.on("input", (event) => {
      const searchText = event.target.value.toLowerCase();
      const filteredSpells = this._getFilteredSpells(spells, searchText);
      
      // Update spell count
      html.find(".skill-count").text(`${filteredSpells.length} spells`);
      
      this._updateSpellList(spellList, filteredSpells);
    });

    // Initial display
    this._updateSpellList(spellList, spells);
  }

  /**
   * Get filtered spells based on search text
   */
  _getFilteredSpells(spells, searchText) {
    if (!searchText || searchText.length === 0) {
      return spells;
    }
    
    return spells.filter((spell) =>
      spell.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }

  /**
   * Update spell list - simplified version showing only name and page reference
   */
  _updateSpellList(spellList, filteredSpells) {
    spellList.empty();

    if (filteredSpells.length === 0) {
      spellList.append('<div class="no-results">No spells found</div>');
      return;
    }

    for (const spell of filteredSpells) {
      const spellName = spell.name;
      const pageRef = spell.pageref || 'B174'; // Default page reference
      
      const skillRow = `
        <div class="skill-row">
          <div class="skill-name">
            <span>${spellName}</span>
          </div>
          <div class="skill-reference">
            <span class="pdflink">${pageRef}</span>
          </div>
        </div>
      `;
      
      spellList.append(skillRow);
    }
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
