# Bitcoin Mining Financial Model

A comprehensive financial modeling application for Bitcoin miners to generate monthly projections including:
- Multi-project management
- Site and power tranche configuration
- ASIC fleet management
- Team member allocation
- Economic scenario modeling
- Detailed financial metrics (revenue, expenses, EBITDA, cost per BTC)

## Getting Started

Install dependencies:
```bash
pnpm install
```

Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The application is fully functional and ready to use. All core features are implemented and tested.

## Application Structure

The app uses a project-based hierarchy:

```
/ (Homepage - No sidebar)
└── Projects Gallery
    └── Click any project card →
        ├── /[projectId]/sites - Configure sites and tranches
        ├── /[projectId]/fleets - Manage ASIC fleets
        ├── /[projectId]/team - Team assignments
        ├── /[projectId]/results - Financial projections
        └── /[projectId]/settings/ - Project-specific settings
            ├── team-profiles
            ├── asic-models  
            └── economics
```

**Navigation:**
- **Homepage**: Clean projects gallery with no sidebar - click any project card to open it
- **Inside a Project**: Sidebar appears with project name and full navigation
- **"← All projects"**: Returns you to the homepage from anywhere in a project

## Features

### Bitcoin Halving Support ⚡
- **Automatic Block Reward Calculation**: The app automatically adjusts block rewards based on Bitcoin's halving schedule
- **Current reward**: 3.125 BTC per block (after April 2024 halving)
- **Historical support**: Correctly calculates rewards for any date from Bitcoin's genesis
- **Future-proof**: Includes estimated dates for upcoming halvings through 2032

### Projects (Homepage)
- Clean, focused homepage displaying all your projects as cards
- Click any project card to open it and access all features
- Create, edit, and delete projects with ease
- Export/import individual projects as JSON for backup and sharing
- Projects are independent - each contains its own sites, fleets, team, and scenarios

### Sites Management
- Configure mining sites with multiple power tranches
- Define power capacity (MW), ramp-up periods, and uptime expectations
- Detailed CAPEX breakdown (electrical, civil, warehouse, containers, office, IT)
- Yearly OPEX configuration (insurance, maintenance, security, monitoring)
- Set electricity prices and pool fees per tranche

### ASIC Fleet Management
- Choose from predefined ASIC models (Antminer S19 XP, S21, Whatsminer M50S, etc.)
- Add custom ASIC models (all models are fully editable)
- Define fleets by number of miners OR MW capacity (auto-converts)
- Set origination dates, lifespan, and yearly failure rates
- **Automatic Fleet Lifecycle**: Fleets automatically become inactive after their lifespan expires
- Assign fleets to specific sites
- Automatic tracking of miner failures and spare capacity

### Team Management
- Create team profiles with annual salaries
- Assign team members at company, site, or tranche level
- Configure employment rates (full-time, part-time, etc.)
- Automatic salary allocation in financial calculations

### Economic Scenarios
- **Automatic Duration Matching**: Scenarios automatically match your project's start and end dates
- **Real-Time Data Integration**: Fetches live data from [mempool.space API](https://mempool.space/):
  - Current BTC price
  - Current global hashrate (~1,147 EH/s as of Oct 2024)
  - Recent transaction fees average (30-day rolling)
- **Smart Start Date Handling**:
  - **Past/Present projects**: Uses current market data
  - **Future projects**: Extrapolates from current data to project start date
- **Trend-Based Generation**: Choose from three BTC price trends when auto-generating:
  - **Pessimistic**: -1% avg monthly decline (bear market)
  - **Normal**: +0.5% avg monthly growth (steady market)
  - **Optimistic**: +2% avg monthly growth (bull market)
- **Hashprice Validation**: Ensures realistic miner profitability
  - **Hashprice** = BTC Price / Hashrate ($/EH/s)
  - Pessimistic: $30-80/EH/s range
  - Normal: $60-120/EH/s range
  - Optimistic: $90-200/EH/s range
  - Automatically adjusts hashrate if profitability becomes unrealistic
- **Random Walk Generation**: Uses geometric Brownian motion to simulate realistic price movements
  - BTC price: Trend-based drift with 15% volatility
  - Global hashrate: **Always upward** at 3% avg monthly growth with 5% volatility
  - Transaction fees: **Realistic variability** - 1% avg monthly growth with 10% volatility
    - **No artificial cap** - fees can grow naturally with network adoption
    - **5% chance of spike events** per month (2-5x multiplier) to simulate congestion
    - Based on historical data showing fees ranging from 0.01 to 1+ BTC per block
- **Interactive Visualizations**: 
  - Line charts for BTC price evolution
  - Hashrate growth projections
  - Transaction fee trends
- **Manual Editing**: Fine-tune any generated data month by month
- **Export to CSV**: Download scenario data for external analysis

### Results & Projections
- Comprehensive monthly financial metrics
- Interactive charts:
  - Revenue vs Expenses
  - EBITDA trends
  - Cost per BTC over time
  - BTC mined and hashrate allocation
- Site-by-site breakdown
- Export results to CSV
- Summary statistics across entire project period

## Example Walkthrough

Here's a complete example to help you get started:

### Scenario: 10 MW Mining Facility in Texas

**Goal**: Model a 10 MW facility with Antminer S19 XP miners, launching in January 2024 with a 3-month ramp-up.

**Step-by-step:**

1. **Create Project** (Homepage)
   - Click "New Project"
   - Name: "Texas Site Alpha"
   - Start: 2024-01-01
   - End: 2025-12-31
   - You'll be automatically taken into the project

2. **Create Team Profiles** (Settings → Team Profiles)
   - Site Manager: $120,000/year
   - Technician: $65,000/year

3. **Review ASIC Models** (Settings → ASIC Models)
   - Select Antminer S19 XP: 3010W, 140 TH/s
   - Note: ~332 miners per MW

4. **Create Economic Scenario** (Settings → Economics)
   - Name: "Conservative 2024"
   - Select trend: "Normal" (or "Pessimistic" for conservative modeling)
   - Click "Auto-Generate" - uses current BTC price (~$108k)
   - Automatically generates 24 months matching project duration
   - Hashrate and TX fees will trend upward automatically
   - Or manually enter custom values for each month

5. **Add Site** (Sites)
   - Name: "Corpus Christi Facility"
   - Start: 2024-01-01
   - Add Tranche:
     - Power: 10 MW
     - Start: 2024-01-01
     - Ramp-up: 3 months
     - Uptime: 0.95 (95%)
     - Electricity: $0.045/kWh
     - Pool Fee: 0.02 (2%)
     - CAPEX: Electrical $2M, Civil $500K, Warehouse $200K, etc.
     - OPEX: Insurance $50K/yr, Maintenance $100K/yr, etc.

6. **Create Fleet** (Fleets)
   - Model: Antminer S19 XP
   - Input Mode: MW
   - Quantity: 10 MW (auto-calculates to ~3,320 miners)
   - Origination: 2024-01-01
   - Lifespan: 5 years
   - Failure Rate: 0.05 (5%/year)
   - Click "Assign" → Select "Corpus Christi Facility"

7. **Add Team** (Team)
   - Site Manager (1):
     - Profile: Site Manager
     - Scope: Site → Corpus Christi Facility
     - Employment: 100%
   - Technicians (3):
     - Profile: Technician
     - Scope: Site → Corpus Christi Facility  
     - Employment: 100% each

8. **Calculate Results** (Results)
   - Click "Calculate Projections"
   - View Conservative 2024 scenario
   - Expected results (approximate):
     - Month 1: ~1.1 MW active (ramp-up), ~33 BTC mined
     - Month 3: ~3.3 MW active, ~100 BTC mined
     - Month 4+: ~9.5 MW active (95% uptime), ~300+ BTC/month
     - Total revenue: Depends on BTC price trajectory
     - Break-even: Typically within 12-18 months

9. **Create Alternative Scenarios**
   - Add "Optimistic" scenario with higher BTC prices
   - Add "Pessimistic" with lower prices or higher hashrate growth
   - Compare in Results page

## How to Use

### 1. Initial Setup (Settings)

**Team Profiles** (`Settings → Team Profiles`):
- Create roles like "Site Manager", "Technician", "Engineer"
- Set annual salaries for each role

**ASIC Models** (`Settings → ASIC Models`):
- Review predefined models or add custom ones
- Note the miners/MW conversion for planning

**Economics** (`Settings → Economics`):
- Create at least one scenario (e.g., "Conservative", "Optimistic")
- Use auto-generate for quick setup or enter custom monthly data
- Include BTC price forecasts, global hashrate growth, and transaction fees

### 2. Create a Project

1. From the **homepage**, click "New Project"
2. Enter project name, start date, and end date
3. Click "Create" - you'll be taken directly into the project
4. The project is now active and you'll see it in the sidebar

### 3. Configure Sites

1. Inside your project, go to **Sites** page (from sidebar)
2. Click "Add Site" and enter site details
3. For each site, click "Add Tranche" to define power availability:
   - Power capacity in MW
   - Start date and ramp-up period (linear growth)
   - Uptime estimate (e.g., 0.95 for 95%)
   - CAPEX and OPEX details
   - Electricity price ($/kWh)
   - Pool fee (e.g., 0.02 for 2%)

### 4. Create and Assign Fleets

1. Go to **Fleets** page
2. Click "Add Fleet":
   - Select ASIC model
   - Choose input mode (miners or MW)
   - Enter quantity
   - Set origination date, lifespan, and failure rate
3. Click the link icon to assign fleet to a site
4. Fleets automatically fill available power capacity chronologically

### 5. Assign Team Members

1. Go to **Team** page
2. Click "Add Team Member":
   - Select team profile
   - Choose scope (company-wide, specific site, or specific tranche)
   - Set employment rate (100% = full-time)
   - Start date is auto-filled for site/tranche assignments

### 6. Calculate Results

1. Go to **Results** page
2. Click "Calculate Projections"
3. Switch between scenarios using tabs
4. Review summary cards, charts, and monthly details
5. Click on months to expand site-by-site breakdown
6. Export to CSV for further analysis

## Calculation Methodology

### Revenue Calculation

The app uses the correct Bitcoin mining revenue formula:

```
Monthly Hashrate (TH/s) = Active Miners × ASIC Hashrate × Uptime
Hashrate Fraction = Our Hashrate / Global Hashrate

Block Reward = Halving-aware (currently 3.125 BTC, halvings every ~4 years)
Blocks per Month = 144 blocks/day × 30 days = 4,320 blocks

BTC from Block Rewards = Hashrate Fraction × Block Reward × Blocks per Month
Transaction Fee Revenue = Hashrate Fraction × TX Fees per Block × Blocks per Month

Total BTC (before pool fees) = BTC from Block Rewards + Transaction Fee Revenue
Total BTC (after pool fees) = Total BTC × (1 - Pool Fee)

Revenue USD = Total BTC × BTC Price
```

**Halving Schedule:**
- Genesis to Nov 2012: 50 BTC/block
- Nov 2012 to Jul 2016: 25 BTC/block
- Jul 2016 to May 2020: 12.5 BTC/block
- May 2020 to Apr 2024: 6.25 BTC/block
- **Apr 2024 to ~2028: 3.125 BTC/block** ← Current
- ~2028 to ~2032: 1.5625 BTC/block (estimated)

The app automatically uses the correct block reward for each month based on the date.

### Hashprice & Profitability

**Hashprice** is a key metric that represents miner profitability:

```
Hashprice = BTC Price (USD) / Global Hashrate (EH/s)
```

This simplified metric indicates how much revenue miners can generate per unit of hashrate. The app ensures generated scenarios maintain realistic hashprice ranges:

- **Bear Market (Pessimistic)**: $30-80 per EH/s - Low profitability, some miners unprofitable
- **Normal Market**: $60-120 per EH/s - Healthy mining economics
- **Bull Market (Optimistic)**: $90-200 per EH/s - High profitability, attracts new miners

If the random walk creates an unrealistic hashprice (too high or too low), the app automatically adjusts the hashrate to maintain economic realism. This simulates real market dynamics where:
- **Low hashprice** → Unprofitable miners turn off → Hashrate decreases
- **High hashprice** → New miners join → Hashrate increases

### Expenses
```
Electricity Cost = Power Used (MW) × 1000 × 730 hours × Price per kWh
Monthly OPEX = Yearly OPEX / 12
CAPEX Depreciation = Total CAPEX / (5 years × 12 months)
Team Costs = Σ(Annual Salary × Employment Rate / 12) per scope
Total Expenses = Electricity + OPEX + CAPEX + Team
```

### Fleet Management
- Fleets fill sites chronologically by tranche start date
- Ramp-up is linear over specified months
- Failed miners = Original Miners × Failure Rate × (Months Since Origination / 12)
- Spare miners replace failed miners when available
- Fleets beyond lifespan are considered fully failed

### Financial Metrics
```
EBITDA = Revenue - Total Expenses
Cost per BTC = Total Expenses / Total BTC Mined
```

## Data Persistence

- All data is stored locally in IndexedDB
- Works completely offline after first load
- Export projects as JSON for backup
- Import projects to restore or share with others
- No server or account required

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (light theme)
- **Database**: IndexedDB (via idb library)
- **Charts**: Recharts
- **Date Handling**: date-fns

## Development

Build for production:
```bash
pnpm build
```

Start production server:
```bash
pnpm start
```

## Tips

- Start with conservative estimates and create multiple scenarios
- Use the auto-generate feature for economics to quickly create baseline scenarios
- Export your project regularly as backup
- Compare multiple scenarios in the Results page to understand sensitivity
- Pay attention to the ramp-up period - it significantly impacts early revenue
- Consider team costs scaling with site/tranche growth for accurate projections
- Monitor the cost per BTC metric to ensure profitability at different BTC prices

## Troubleshooting

### App is not loading data
- Check browser console for errors
- Clear IndexedDB data (browser dev tools → Application → Storage → IndexedDB)
- Refresh the page

### Calculations show zero or incorrect values
- Ensure you have:
  - Created at least one project and selected it
  - Added at least one site with tranches
  - Created and assigned at least one fleet to a site
  - Created an economic scenario with data
- Verify fleet origination dates are before or during the project period
- Check that tranches have started (start date is before the calculation month)

### Fleet allocation not working
- Verify fleet is assigned to the correct site
- Check that site has tranches with available power
- Ensure tranche start dates have passed
- Check ramp-up periods - power may not be fully available yet

### Export/Import issues
- Ensure exported file is valid JSON
- Check that the imported file has the correct version format
- Try exporting a fresh copy and re-importing

### Browser compatibility
- This app uses IndexedDB which is supported in all modern browsers
- Chrome, Firefox, Safari, and Edge are all fully supported
- Private/Incognito mode may have storage limitations

## FAQ

**Q: Can I share my project with others?**
A: Yes, use the Export function on the Projects page to download a JSON file, then others can import it.

**Q: How often should I export my data?**
A: Export your project regularly (weekly or after major changes) as a backup. Data is stored locally in your browser.

**Q: Can I run multiple scenarios at once?**
A: Yes! Create multiple economic scenarios in Settings → Economics, then view results for each in the Results page.

**Q: What happens to spare miners?**
A: Spare miners (unallocated to sites) automatically replace failed miners. Once spares are exhausted, capacity decreases.

**Q: How is the ramp-up calculated?**
A: Ramp-up is linear. If you set 6 months ramp-up for 10 MW, month 1 has ~1.67 MW, month 2 has ~3.33 MW, etc.

**Q: Can I change ASIC models after creating a fleet?**
A: Yes, edit the fleet to change the model. This will recalculate miners/MW conversions.

**Q: What's the difference between site and tranche?**
A: A site is a physical location. Tranches are power expansion phases within a site, each with its own timeline and costs.

**Q: How accurate are the financial projections?**
A: Projections depend on your input accuracy. Use conservative estimates and create multiple scenarios for sensitivity analysis.

**Q: Can I model different electricity prices over time?**
A: Currently, electricity prices are set per tranche. You can model price changes by creating multiple tranches with different start dates.

**Q: What depreciation period is used for CAPEX?**
A: CAPEX is depreciated over 5 years (60 months) by default.

**Q: How do I model a halving event?**
A: In your economic scenario, reduce the block reward (currently 6.25 BTC) to 3.125 BTC for months after the halving.

## Keyboard Shortcuts

- Most dialogs can be closed with `Esc`
- Forms can be submitted with `Enter`
- Navigate between pages using the sidebar

## Performance Tips

- For large projects (50+ months), calculations may take a few seconds
- Keep number of sites and fleets reasonable (under 20 each) for best performance
- Export large projects periodically to avoid browser storage issues

## Contributing

This is a private tool. For feature requests or bug reports, contact the development team.

## License

Private use only.
