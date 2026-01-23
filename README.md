# Puzzle Warz - Puzzle Platform

A fully-featured Alternate Reality Game (ARG) puzzle platform with multiplayer collaboration, real-time leaderboards, and progressive puzzle unlocking.

## Features

### 🎮 Core Gameplay
- **Multi-stage Puzzles**: Progressive puzzle chains with dependencies
- **Collaborative Teams**: Create or join teams for multiplayer solving
- **Flexible Answer Matching**: Support for exact matches, regex patterns, and case-insensitive checking
- **Hint System**: Contextual hints with point costs and usage limits
- **Progress Tracking**: Track individual and team progress

### 👥 Team System
- **Team Management**: Create, manage, and invite players to teams
- **Roles & Permissions**: Admin, moderator, and member roles
- **Team Leaderboards**: Compete with other teams globally
- **Real-time Collaboration**: Live updates when team members solve puzzles

### 🏆 Competitive Features
- **Leaderboards**: Global and puzzle-specific rankings
- **Points System**: Earn points for solving puzzles and beating time records
- **Achievements**: Track puzzle difficulty and solve streaks
- **Announcements**: Broadcast events and puzzle releases

### 🔐 Security
- **NextAuth.js**: Secure authentication with email/password and OAuth support
- **MySQL**: Robust relational database
- **Validation**: Input validation with Zod

## Tech Stack

- **Frontend**: Next.js 14+ with React
- **Backend**: Next.js API routes
- **Database**: MySQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Real-time**: Socket.io (ready for implementation)
- **Validation**: Zod
- **Language**: TypeScript

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/              # Authentication endpoints
│   │   ├── puzzles/           # Puzzle endpoints
│   │   ├── teams/             # Team management endpoints
│   │   └── leaderboards/      # Leaderboard endpoints
│   ├── page.tsx               # Home page
│   └── layout.tsx             # Root layout
├── lib/
│   ├── auth.ts                # NextAuth configuration
│   └── prisma.ts              # Prisma client singleton
├── components/                # Reusable React components
└── styles/                    # Global styles
prisma/
├── schema.prisma              # Database schema
└── migrations/                # Database migrations
```

## Database Schema

The database includes models for:
- **Users**: Authentication and profiles
- **Teams**: Multiplayer groups with membership management
- **Puzzles**: Challenge definitions with solutions and hints
- **Progress**: User and team progress tracking
- **Submissions**: Answer tracking and statistics
- **Leaderboards**: Ranking and scoring

## Getting Started

### Prerequisites
### 🔐 Security
- **NextAuth.js**: Secure authentication with email/password and OAuth support
- **MySQL**: Robust relational database
- **Validation**: Input validation with Zod

### Installation
- **Database**: MySQL with Prisma ORM
   npm install
   ```
### Prerequisites
- Node.js 18+
- MySQL 8+
- npm
   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/kryptyk_labs_arg"
2. **Configure environment**:
   - Edit `.env.local` with your MySQL connection string:
   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/kryptyk_labs_arg"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-change-in-production"
   ```
   npx prisma migrate dev --name init
   ```
   This will create the database schema and generate the Prisma client.

| `DATABASE_URL` | MySQL connection string | Yes |
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

### Puzzles
- `GET /api/puzzles` - Get all active puzzles (supports filtering by category)
- `POST /api/puzzles/submit` - Submit an answer to a puzzle

### Teams
- `GET /api/teams` - Get user's teams with progress
- `POST /api/teams` - Create a new team

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signup` - Register new account
- `GET /api/auth/session` - Get current session

## Development

### Running Prisma Studio
View and manage your database with a beautiful UI:
```bash
npx prisma studio
```

### Database Migrations
After modifying `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name <description_of_change>
```

### Type Generation
TypeScript types are auto-generated from the schema in `src/generated/prisma/`

## Key Features to Build Next

- [ ] User registration and login UI pages
- [ ] Puzzle display and submission interface
- [ ] Team creation and management UI
- [ ] Real-time leaderboards with Socket.io
- [ ] Hint system UI with point costs
- [ ] Team collaboration and notifications
- [ ] Admin dashboard for puzzle management
- [ ] Analytics and player statistics
- [ ] Deployment to production

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string | Yes |
| `NEXTAUTH_URL` | Next.js app URL | Yes |
| `NEXTAUTH_SECRET` | Secret for NextAuth | Yes |
| `GITHUB_ID` | GitHub OAuth ID | No |
| `GITHUB_SECRET` | GitHub OAuth secret | No |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | No |

## Performance Optimization

- Database queries use indexed fields for fast lookups
- Connection pooling configured for production
- **MySQL**: Robust relational database
- Leaderboards can be cached with Redis for large player bases

## Security Considerations

- Passwords hashed with bcryptjs
- CSRF protection via NextAuth
- **Database**: MySQL with Prisma ORM
- SQL injection protected via Prisma
- Rate limiting recommended for endpoints

## Deployment

### Recommended Platforms
- **Frontend**: Vercel (optimized for Next.js)
- **Database**: Render, Railway, or AWS RDS
- **Environment**: Use production database with backups

### Pre-deployment
- [ ] Change `NEXTAUTH_SECRET` to strong random value
- [ ] Set production database URL
- [ ] Configure CORS if needed
- [ ] Set up monitoring/logging
- [ ] Enable rate limiting
- [ ] Configure SSL/HTTPS

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

### Deleting or decommissioning features
If you plan to remove or decommission a feature, follow the project removal guidelines: see `.github/REMOVAL_GUIDELINES.md` and use the PR checklist in `.github/PULL_REQUEST_TEMPLATE.md` to ensure a safe, reversible cleanup.

## License

MIT

## Support

Create an issue in the repository for questions or problems.

---

**Built with ❤️ for ARG enthusiasts**

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
- **MySQL**: Robust relational database
Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
