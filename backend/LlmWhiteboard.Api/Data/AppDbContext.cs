using LlmWhiteboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<ApiToken> ApiTokens => Set<ApiToken>();
    public DbSet<Machine> Machines => Set<Machine>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<SessionEvent> SessionEvents => Set<SessionEvent>();
    public DbSet<SessionTranscript> SessionTranscripts => Set<SessionTranscript>();
    public DbSet<TranscriptSnapshot> TranscriptSnapshots => Set<TranscriptSnapshot>();
    public DbSet<OAuthAccount> OAuthAccounts => Set<OAuthAccount>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // OAuthAccount
        modelBuilder.Entity<OAuthAccount>(entity =>
        {
            entity.HasIndex(e => new { e.Provider, e.ProviderAccountId }).IsUnique();
            entity.HasIndex(e => e.UserId);

            entity.HasOne(e => e.User)
                .WithMany(u => u.OAuthAccounts)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ApiToken
        modelBuilder.Entity<ApiToken>(entity =>
        {
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.HasIndex(e => e.UserId);

            entity.HasOne(e => e.User)
                .WithMany(u => u.ApiTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Machine
        modelBuilder.Entity<Machine>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.MachineId }).IsUnique();
            entity.HasIndex(e => e.UserId);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Machines)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Session
        modelBuilder.Entity<Session>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.MachineId, e.LocalSessionId }).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.UserId, e.Status });
            entity.HasIndex(e => e.LastActivityAt);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Sessions)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Machine)
                .WithMany(m => m.Sessions)
                .HasForeignKey(e => e.MachineId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.Property(e => e.Status)
                .HasConversion<string>();
        });

        // SessionEvent
        modelBuilder.Entity<SessionEvent>(entity =>
        {
            entity.HasIndex(e => new { e.SessionId, e.CreatedAt });

            entity.HasOne(e => e.Session)
                .WithMany(s => s.Events)
                .HasForeignKey(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.Metadata)
                .HasColumnType("jsonb");
        });

        // SessionTranscript
        modelBuilder.Entity<SessionTranscript>(entity =>
        {
            entity.HasIndex(e => e.SessionId).IsUnique();

            entity.HasOne(e => e.Session)
                .WithOne(s => s.Transcript)
                .HasForeignKey<SessionTranscript>(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // TranscriptSnapshot
        modelBuilder.Entity<TranscriptSnapshot>(entity =>
        {
            entity.HasIndex(e => new { e.SessionId, e.CompactionCycle, e.Type });
            entity.HasIndex(e => new { e.SessionId, e.CreatedAt });

            entity.HasOne(e => e.Session)
                .WithMany(s => s.Snapshots)
                .HasForeignKey(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.Type)
                .HasConversion<string>();
        });
    }
}
