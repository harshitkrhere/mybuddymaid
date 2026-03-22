import re

html_path = r"c:\Users\Harshit\MyBuddyMaid\index.html"

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Fonts and Head
head_insert = """
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/@phosphor-icons/web"></script>
  <link rel="stylesheet" href="styles.css">
"""
content = re.sub(r'<link rel="stylesheet" href="styles.css">', head_insert, content)

# 2. Hero Text updates formatting without emojis
hero_text_old = r"Your Buddy Maid Is Here ❤️"
hero_text_new = r"Experience the New Standard of Home Care."
content = content.replace(hero_text_old, hero_text_new)

# Emojis regex replace
emojis_to_remove = [
    "🏠", "✨", "❤️", "💛", "🤝", "💎", "⭐", "🏆", "📰", "🤔", "🎉", "🥳",
    "🛡️", "🎓", "⚡", "📞", "💰", "🧹", "🏡", "👴", "🤱", "👨‍🍳", "👶", "🇯🇵",
    "🥈", "🥇", "💡", "🎯", "🔍", "🔄", "🏙️", "🔜", "📍"
]

for emoji in emojis_to_remove:
    content = content.replace(emoji, "")

# 3. Fix WhatsApp / Chat buttons which became text only
content = content.replace('class="whatsapp-float" aria-label="WhatsApp"></a>', 'class="whatsapp-float" aria-label="WhatsApp"><i class="ph-fill ph-whatsapp-logo"></i></a>')
content = content.replace('class="dark-toggle" aria-label="Toggle dark mode">🌙</button>', 'class="dark-toggle" aria-label="Toggle dark mode"><i class="ph-fill ph-moon"></i></button>')
content = content.replace('class="dark-toggle" aria-label="Toggle dark mode"></button>', 'class="dark-toggle" aria-label="Toggle dark mode"><i class="ph-fill ph-moon"></i></button>')
content = content.replace('class="chat-bubble" aria-label="Live Chat">💬</button>', 'class="chat-bubble" aria-label="Live Chat"><i class="ph-fill ph-chat-teardrop-dots"></i></button>')
content = content.replace('class="chat-bubble" aria-label="Live Chat"></button>', 'class="chat-bubble" aria-label="Live Chat"><i class="ph-fill ph-chat-teardrop-dots"></i></button>')

# Clean up empty icons that had just emojis
content = re.sub(r'<div class="badge-icon"[^>]*>\s*</div>', r'<div class="badge-icon" style="background:rgba(79,70,229,0.1);color:#4F46E5;"><i class="ph-fill ph-shield-check"></i></div>', content)
content = re.sub(r'<div class="card-icon"[^>]*>\s*</div>', r'<div class="card-icon" style="background:rgba(79,70,229,0.1);color:#4F46E5;"><i class="ph-fill ph-check-circle"></i></div>', content)
content = re.sub(r'<div class="service-icon">\s*</div>', r'<div class="service-icon" style="background:rgba(79,70,229,0.1);color:#4F46E5;"><i class="ph-fill ph-sparkle"></i></div>', content)
content = re.sub(r'<div class="icon">\s*</div>', r'<div class="icon" style="color:#4F46E5; font-size: 2.5rem;"><i class="ph-fill ph-shield-check"></i></div>', content)

# Fix empty button texts
content = content.replace('> ✨ Instant Book</a>', '><i class="ph-bold ph-calendar-plus"></i> Book Now</a>')
content = content.replace('> 💬 WhatsApp</a>', '><i class="ph-bold ph-whatsapp-logo"></i> Contact Us</a>')
content = content.replace('> ✨ Book Now</a>', '><i class="ph-bold ph-calendar-plus"></i> Book Now</a>')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("HTML upgraded completely.")
