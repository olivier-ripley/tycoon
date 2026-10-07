# Images à générer sur Higgsfield

Le jeu affiche ces images dès qu'elles sont posées au bon endroit, sans toucher au code.
Tant qu'un fichier manque, il garde l'ancien affichage (initiale colorée, fenêtre sans image).

Conseils :
- Les prompts sont en anglais : les modèles d'image les comprennent mieux.
- Garde le même modèle et le même style pour toute la série, pour que les images aillent ensemble.
- Pas de texte dans les images (les IA écrivent mal) : sauf l'initiale des logos.

Style commun, à coller à la fin de chaque prompt :

> stylized 3D cartoon game art, glossy and bold like a mobile tycoon game, bright saturated colors, soft studio lighting, clean shapes, no text, no watermark

---

## 1. Logos des enseignes rivales → `img/rivaux/`

Format carré (1:1), PNG. Fond transparent si possible ; sinon fond blanc uni, et on retire le fond ensuite.
Petit affichage (30 px) : un emblème simple et lisible, pas le nom complet.

| Fichier | Prompt |
| --- | --- |
| `megapc.png` | App icon emblem for a discount computer store chain called "MégaPC": a bold white letter M on a rounded square in coral red (#e8504a), a small price tag shape cut into the corner, aggressive and cheap-looking, centered, plain white background |
| `technoplus.png` | App icon emblem for a big-box high-tech superstore chain called "TechnoPlus": a bold white letter T merged with a plus sign, on a rounded square in violet (#6c5ce7), premium and corporate, subtle shine, centered, plain white background |
| `infoproxi.png` | App icon emblem for a friendly neighborhood computer shop chain called "Info Proxi": a bold white letter P shaped like a small shop with an awning, on a rounded square in teal (#2bb3b1), warm and approachable, centered, plain white background |

Pour ces trois-là, remplace « no text » du style commun par « only the single letter, no other text ».

---

## 2. Illustrations des dilemmes → `img/dilemmes/`

Format paysage 16:9 (par exemple 1280 × 720), JPG. L'image s'affiche en haut de la fenêtre de décision.
Décor commun : une petite boutique d'informatique française (rayons de PC portables, écrans, comptoir).

| Fichier | Prompt |
| --- | --- |
| `youtubeur.jpg` | A young tech youtuber with a camera on a gimbal and a ring light, filming excitedly inside a small computer store, laptops on shelves behind |
| `augmentation.jpg` | A store employee in a blue polo shirt standing nervously in a small back office, holding a sheet of paper, asking the manager for a raise, desk with a computer and coffee mug |
| `client-mecontent.jpg` | An angry customer at a computer store counter pointing at a scratched laptop, smartphone in the other hand ready to post a bad review, worried salesperson behind the counter |
| `destockage.jpg` | A delivery van unloading a big pallet of cardboard boxes of computers with large red discount stickers in front of a small computer store, early morning |
| `ecole.jpg` | A bright middle school computer classroom with empty desks waiting for computers, a teacher holding a list, a few boxes of new PCs at the door |
| `debauchage.jpg` | A store employee in a blue polo looking tempted by a business card handed by a slick recruiter in a suit, outside a small computer store, a big shiny rival store in the background |
| `normes.jpg` | A safety inspector with a clipboard and a hard hat examining a messy electrical panel with tangled cables in the repair workshop of a computer store |
| `clim.jpg` | A broken air conditioning unit dripping and smoking on the wall of a small computer store in a summer heatwave, sweating employees fanning themselves, a thermometer showing high heat |
| `salon.jpg` | A busy computer trade show hall with booths, banners without text, gaming PCs with RGB lights, crowds of visitors |
| `influenceuse.jpg` | A young female gaming streamer with a headset playing live on a glowing RGB gaming PC, colorful room, a webcam and microphone, chat bubbles floating |
| `stagiaire.jpg` | An eager young IT student intern with a backpack and a lanyard being welcomed by a smiling technician in the repair workshop of a computer store, a PC open on the bench |

---

## Pour finir

1. Pose les fichiers avec exactement ces noms dans `img/rivaux/` et `img/dilemmes/`.
2. Recharge le jeu : les images apparaissent.
3. Pour changer le nom d'un fichier : champ `logo` dans `data/concurrents.js`, champ `image` d'un dilemme dans `data/dilemmes.js` (`image: false` pour ne rien afficher).
