# Data drop folder

Put the latest Talkwalker export here as **`mentions.csv`** (or `mentions.xlsx`).
Replace the file each hour; don't add a new file next to it.

If one export can't hold everything (Talkwalker caps export size), save one file
per day and list them in `index.json`. Duplicate posts are removed by URL:

```json
{ "files": ["day0-buildup.csv", "day1.csv", "day2.csv", "day3.csv"] }
```

While this folder has no export, the dashboard shows labelled sample data.
