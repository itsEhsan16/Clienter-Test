# Clienter - Agency Management Platform

A comprehensive full-stack web application for managing clients, projects, expenses, tasks, teams, and meetings. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Client Management**: Track and manage client information and relationships
- **Project Management**: Create, organize, and track projects with team collaboration
- **Expense Tracking**: Monitor and categorize business expenses
- **Task Management**: Organize and track tasks with status management
- **Team Management**: Coordinate team members and manage team hierarchies
- **Meeting Management**: Schedule and track meetings with clients and team members
- **Authentication**: Secure OAuth integration with user account management
- **Multi-tenant Support**: Full agency management capabilities

## Tech Stack

- **Frontend**: Next.js 15+, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL), RESTful API
- **Authentication**: OAuth with PKCE flow
- **Deployment**: Vercel
- **Package Manager**: npm

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project
- Environment variables configured

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd clienter
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create a `.env.local` file with your Supabase credentials and other configuration:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Main dashboard
│   ├── clients/        # Client management
│   ├── projects/       # Project management
│   ├── expenses/       # Expense tracking
│   ├── tasks/          # Task management
│   ├── team/           # Team management
│   └── meetings/       # Meeting management
├── components/         # Reusable React components
├── contexts/           # React Context providers
├── lib/                # Utility functions
├── types/              # TypeScript type definitions
└── store/              # State management

supabase/
├── migrations/         # Database migrations
└── schema.sql          # Database schema definition
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Database Setup

The application uses Supabase PostgreSQL. Run migrations:

```bash
npm run apply-migration
```

## Contributing

Please follow the coding standards and commit messages convention established in the project.

## License

Licensed under the MIT License - see the [LICENSE](LICENSE) file for details
