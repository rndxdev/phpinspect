<?php

namespace App\Models;

interface Loggable
{
    public function log(string $message): void;
}

interface Cacheable
{
    public function getCacheKey(): string;
    public function getCacheTtl(): int;
}

trait TimestampsTrait
{
    protected ?string $createdAt = null;
    protected ?string $updatedAt = null;

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setUpdatedAt(string $date): void
    {
        $this->updatedAt = $date;
    }
}

abstract class BaseModel
{
    protected int $id;
    protected string $table;

    abstract public function find(int $id): ?self;
    abstract public function save(): bool;

    public function getId(): int
    {
        return $this->id;
    }
}

class User extends BaseModel implements Loggable, Cacheable
{
    use TimestampsTrait;

    private string $name;
    private string $email;
    private string $password;
    private array $roles;
    private ?Profile $profile = null;

    public function __construct(string $name, string $email, string $password)
    {
        $this->name = $name;
        $this->email = $email;
        $this->password = $password;
        $this->roles = [];
    }

    public function find(int $id): ?self
    {
        // stub
        return null;
    }

    public function save(): bool
    {
        return true;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function log(string $message): void
    {
        echo "[User:{$this->name}] $message\n";
    }

    public function getCacheKey(): string
    {
        return "user_{$this->id}";
    }

    public function getCacheTtl(): int
    {
        return 3600;
    }

    // Intentionally complex method to trigger smell detection
    public function processPermissions(array $permissions, array $groups, bool $isAdmin, string $context, int $level, array $overrides)
    {
        $result = [];
        foreach ($permissions as $perm) {
            if ($isAdmin) {
                $result[] = $perm;
            } else {
                foreach ($groups as $group) {
                    if ($group === $context) {
                        if ($level > 3) {
                            if (isset($overrides[$perm])) {
                                $result[] = $overrides[$perm];
                            } else {
                                $result[] = $perm;
                            }
                        } else {
                            if ($perm !== 'admin') {
                                $result[] = $perm;
                            }
                        }
                    } else {
                        if ($level > 1 && !in_array($perm, $overrides)) {
                            $result[] = $perm;
                        }
                    }
                }
            }
        }
        return $result;
    }
}

class Profile
{
    public string $bio;
    public string $avatar;
    public string $website;
    public array $socialLinks;
    public string $location;
    public string $timezone;
    public ?string $phone;
    public ?string $company;
    public ?string $title;
    public ?string $birthday;
    public ?string $language;
    public ?string $theme;
    public ?string $newsletter;
    public ?string $twoFactor;
    public ?string $recoveryEmail;
    public ?string $lastLogin;

    public function getBio() { return $this->bio; }
    public function getAvatar() { return $this->avatar; }
    public function getWebsite() { return $this->website; }
    public function getSocialLinks() { return $this->socialLinks; }
    public function getLocation() { return $this->location; }
    public function getTimezone() { return $this->timezone; }
    public function getPhone() { return $this->phone; }
    public function getCompany() { return $this->company; }
    public function getTitle() { return $this->title; }
    public function getBirthday() { return $this->birthday; }
    public function getLanguage() { return $this->language; }
    public function getTheme() { return $this->theme; }
    public function getNewsletter() { return $this->newsletter; }
    public function getTwoFactor() { return $this->twoFactor; }
    public function getRecoveryEmail() { return $this->recoveryEmail; }
    public function getLastLogin() { return $this->lastLogin; }
    public function setBio($bio) { $this->bio = $bio; }
    public function setAvatar($avatar) { $this->avatar = $avatar; }
}
