chrome.runtime.onInstalled.addListener(function () {

    let default_options = {
        "local": {
            "previous_colors": null,
            "previous_theme": null,
            "errors": [],
            "saved_themes": {},
            "liked_themes": [],
        },
        "sync": {
            "dark_preset": {
                "background-0": "#161616",
                "background-1": "#1e1e1e",
                "background-2": "#262626",
                "borders": "#3c3c3c",
                "text-0": "#f5f5f5",
                "text-1": "#e2e2e2",
                "text-2": "#ababab",
                "links": "#56Caf0",
                "sidebar": "#1e1e1e",
                "sidebar-text": "#f5f5f5"
            },
            "new_install": true,
            "assignments_due": true,
            "gpa_calc": false,
            "dark_mode": true,
            "gradient_cards": false,
            "disable_color_overlay": false,
            "auto_dark": false,
            "auto_dark_start": { "hour": "20", "minute": "00" },
            "auto_dark_end": { "hour": "08", "minute": "00" },
            "num_assignments": 4,
            "custom_domain": [""],
            "assignments_done": [],
            "dashboard_grades": false,
            "assignment_date_format": false,
            "dashboard_notes": false,
            "dashboard_notes_text": "",
            "better_todo": false,
            "todo_hr24": false,
            "condensed_cards": false,
            "custom_cards": {},
            "custom_cards_2": {},
            "custom_cards_3": {},
            "custom_assignments": [],
            "custom_assignments_overflow": ["custom_assignments"],
            "grade_hover": false,
            "hide_completed": false,
            "num_todo_items": 4,
            "custom_font": { "link": "", "family": "" },
            "hover_preview": true,
            "full_width": null,
            "remlogo": null,
            "gpa_calc_bounds": {
                "A+": { "cutoff": 97, "gpa": 4.3 },
                "A": { "cutoff": 93, "gpa": 4 },
                "A-": { "cutoff": 90, "gpa": 3.7 },
                "B+": { "cutoff": 87, "gpa": 3.3 },
                "B": { "cutoff": 83, "gpa": 3 },
                "B-": { "cutoff": 80, "gpa": 2.7 },
                "C+": { "cutoff": 77, "gpa": 2.3 },
                "C": { "cutoff": 73, "gpa": 2 },
                "C-": { "cutoff": 70, "gpa": 1.7 },
                "D+": { "cutoff": 67, "gpa": 1.3 },
                "D": { "cutoff": 63, "gpa": 1 },
                "D-": { "cutoff": 60, "gpa": .7 },
                "F": { "cutoff": 0, "gpa": 0 }
            },
            "todo_overdues": false,
            "card_overdues": false,
            "relative_dues": false,
            "hide_feedback": false,
            "dark_mode_fix": [],
            "assignment_states": {},
            "tab_icons": false,
            "todo_colors": false,
            "device_dark": false,
            "cumulative_gpa": { "name": "Cumulative GPA", "hidden": false, "weight": "dnc", "credits": 999, "gr": 3.21 },
            "show_updates": false,
            "card_method_date": false,
            "card_method_dashboard": false,
            "card_limit": 25,
            "remind": false,
            "reminders": [],
            "reminder_count": 1,
            "multi_remind": false,
            "id": "",
            "new_browser": null,
            "gpa_calc_cumulative": false,
            "gpa_calc_weighted": true,
            "browser_show_likes": false,
            "custom_styles": "",
        }
    };

    const updateMsg = "Better Canvas was just updated!\nThis version added new themes, cumulative GPA into the GPA calculator, and a new sorting function for themes.";

    chrome.storage.local.get(null, local => {
        chrome.storage.sync.get(null, async sync => {
            let newSyncOptions = {"update_msg": updateMsg};
            let newLocalOptions = {};
            Object.keys(default_options["sync"]).forEach(option => {
                if (sync[option] !== undefined) return;
                newSyncOptions[option] = default_options["sync"][option];
            });
            Object.keys(default_options["local"]).forEach(option => {
                if (local[option] !== undefined) return;
                newLocalOptions[option] = default_options["local"][option];
            })

            if (Object.keys(newLocalOptions).length > 0) {
                chrome.storage.local.set(newLocalOptions);
            }

            if (Object.keys(newSyncOptions).length > 0) {
                chrome.storage.sync.set(newSyncOptions).then(() => {
                    console.log(newSyncOptions);
                    if (newSyncOptions.new_install === true) {
                        chrome.runtime.openOptionsPage();
                        chrome.storage.sync.set({ new_install: false });
                    }
                });
            }
        });
    });
});

chrome.runtime.setUninstallURL("https://diditupe.dev/bettercanvas/goodbye");
