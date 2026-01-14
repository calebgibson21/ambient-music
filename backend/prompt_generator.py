"""
Generates Lyria music prompts based on book metadata.
Maps book genres/subjects to musical moods and characteristics.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class WeightedPrompt:
    """A music prompt with an associated weight."""
    text: str
    weight: float = 1.0


# Genre/subject to music prompt mappings
GENRE_MUSIC_MAP: dict[str, list[str]] = {
    # Horror & Thriller
    "horror": ["Dark Ambient", "Ominous Drone", "Unsettling", "Eerie"],
    "thriller": ["Tense", "Suspenseful", "Dark Ambient", "Minimal"],
    "suspense": ["Atmospheric", "Tension", "Minimal Techno", "Dark"],
    "gothic": ["Dark Ambient", "Orchestral Score", "Haunting", "Melancholic"],
    
    # Romance & Drama
    "romance": ["Piano Ballad", "Emotional", "Dreamy", "Warm"],
    "love": ["Romantic", "Piano", "Soft", "Emotional"],
    "drama": ["Emotional", "Orchestral", "Cinematic", "Rich Orchestration"],
    
    # Science Fiction
    "science fiction": ["Synthpop", "Ethereal Ambience", "Experimental", "Electronic"],
    "sci-fi": ["Synthpop", "Futuristic", "Ambient Electronic", "Spacey"],
    "dystopia": ["Dark Synth", "Industrial", "Ominous", "Electronic"],
    "space": ["Ambient", "Ethereal", "Cosmic", "Dreamy"],
    "cyberpunk": ["Synthwave", "Dark Electronic", "Industrial", "Glitchy Effects"],
    
    # Fantasy & Adventure
    "fantasy": ["Orchestral Score", "Ethereal", "Rich Orchestration", "Epic"],
    "magic": ["Mystical", "Ethereal Ambience", "Orchestral", "Enchanting"],
    "adventure": ["Epic", "Orchestral", "Upbeat", "Cinematic"],
    "mythology": ["Ancient", "Orchestral", "Mystical", "World Music"],
    
    # Mystery & Crime
    "mystery": ["Jazz Fusion", "Subdued Melody", "Atmospheric", "Noir"],
    "detective": ["Jazz", "Smooth", "Mysterious", "Film Noir"],
    "crime": ["Dark Jazz", "Tense", "Urban", "Atmospheric"],
    "noir": ["Jazz", "Smoky", "Melancholic", "Vintage"],
    
    # History & Non-fiction
    "history": ["Classical", "Ambient", "Sustained Chords", "Timeless"],
    "biography": ["Classical", "Reflective", "Ambient", "Thoughtful"],
    "war": ["Orchestral", "Epic", "Dramatic", "Somber"],
    "historical fiction": ["Period", "Classical", "Orchestral", "Elegant"],
    
    # Poetry & Literature
    "poetry": ["Indie Folk", "Acoustic Instruments", "Chill", "Intimate"],
    "literary fiction": ["Ambient", "Thoughtful", "Piano", "Contemplative"],
    "classics": ["Classical", "Timeless", "Orchestral", "Elegant"],
    
    # Philosophy & Spirituality
    "philosophy": ["Ambient", "Meditation", "Contemplative", "Minimal"],
    "spirituality": ["Meditation", "Ethereal", "Peaceful", "Ambient"],
    "religion": ["Sacred", "Choral", "Contemplative", "Peaceful"],
    
    # Action & Excitement
    "action": ["Energetic", "Driving Beat", "Intense", "Powerful"],
    "sports": ["Upbeat", "Energetic", "Motivating", "Dynamic"],
    
    # Children & Young Adult
    "children": ["Playful", "Bright Tones", "Whimsical", "Light"],
    "young adult": ["Pop", "Upbeat", "Emotional", "Contemporary"],
    
    # Comedy & Humor
    "comedy": ["Light", "Playful", "Jazzy", "Upbeat"],
    "humor": ["Quirky", "Playful", "Light", "Fun"],
    
    # Nature & Environment
    "nature": ["Acoustic", "Peaceful", "Ambient", "Organic"],
    "environment": ["Ambient", "Natural", "Peaceful", "Flowing"],
    
    # Default fallback
    "fiction": ["Ambient", "Atmospheric", "Cinematic", "Emotional"],
    "non-fiction": ["Classical", "Ambient", "Thoughtful", "Clean"],
}

# Mood modifiers based on descriptive keywords that might appear in descriptions
MOOD_KEYWORDS: dict[str, dict[str, float]] = {
    # Dark/Intense moods
    "dark": {"brightness": 0.2, "density": 0.4},
    "haunting": {"brightness": 0.3, "density": 0.3},
    "intense": {"brightness": 0.5, "density": 0.8},
    "violent": {"brightness": 0.3, "density": 0.7},
    "tragic": {"brightness": 0.3, "density": 0.5},
    
    # Light/Uplifting moods
    "hopeful": {"brightness": 0.8, "density": 0.5},
    "joyful": {"brightness": 0.9, "density": 0.7},
    "light": {"brightness": 0.8, "density": 0.4},
    "peaceful": {"brightness": 0.7, "density": 0.3},
    "beautiful": {"brightness": 0.7, "density": 0.5},
    
    # Energetic moods
    "exciting": {"brightness": 0.7, "density": 0.8},
    "fast-paced": {"brightness": 0.6, "density": 0.9},
    "action": {"brightness": 0.6, "density": 0.8},
    
    # Calm moods
    "contemplative": {"brightness": 0.5, "density": 0.3},
    "meditative": {"brightness": 0.6, "density": 0.2},
    "quiet": {"brightness": 0.5, "density": 0.2},
    "subtle": {"brightness": 0.5, "density": 0.3},
}


def _normalize_subject(subject: str) -> str:
    """Normalize a subject string for matching."""
    return subject.lower().strip()


def _find_matching_genres(subjects: list[str]) -> list[tuple[str, list[str]]]:
    """Find matching genre mappings for the given subjects."""
    matches = []
    for subject in subjects:
        normalized = _normalize_subject(subject)
        for genre_key, prompts in GENRE_MUSIC_MAP.items():
            if genre_key in normalized or normalized in genre_key:
                matches.append((genre_key, prompts))
                break
    return matches


def _analyze_description_mood(description: Optional[str]) -> dict[str, float]:
    """Analyze description text to determine mood parameters."""
    if not description:
        return {"brightness": 0.5, "density": 0.5}
    
    desc_lower = description.lower()
    brightness_sum = 0.0
    density_sum = 0.0
    count = 0
    
    for keyword, params in MOOD_KEYWORDS.items():
        if keyword in desc_lower:
            brightness_sum += params["brightness"]
            density_sum += params["density"]
            count += 1
    
    if count == 0:
        return {"brightness": 0.5, "density": 0.5}
    
    return {
        "brightness": brightness_sum / count,
        "density": density_sum / count,
    }


def generate_music_prompts(
    title: str,
    subjects: Optional[list[str]] = None,
    description: Optional[str] = None,
    authors: Optional[list[str]] = None,
) -> tuple[list[WeightedPrompt], dict[str, float]]:
    """
    Generate Lyria music prompts based on book metadata.
    
    Args:
        title: The book title
        subjects: List of book subjects/genres
        description: Book description text
        authors: List of author names
    
    Returns:
        Tuple of (list of WeightedPrompt, config dict with brightness/density)
    """
    prompts: list[WeightedPrompt] = []
    subjects = subjects or []
    
    # Find matching genres from subjects
    genre_matches = _find_matching_genres(subjects)
    
    if genre_matches:
        # Use the first two matching genres with decreasing weights
        seen_prompts: set[str] = set()
        for i, (_, music_prompts) in enumerate(genre_matches[:3]):
            weight = 1.0 - (i * 0.2)  # 1.0, 0.8, 0.6
            for prompt_text in music_prompts[:2]:  # Take top 2 from each genre
                if prompt_text not in seen_prompts:
                    prompts.append(WeightedPrompt(text=prompt_text, weight=weight))
                    seen_prompts.add(prompt_text)
    else:
        # Default ambient prompts if no genre matches
        prompts = [
            WeightedPrompt(text="Ambient", weight=1.0),
            WeightedPrompt(text="Atmospheric", weight=0.8),
            WeightedPrompt(text="Cinematic", weight=0.6),
        ]
    
    # Add a base ambient prompt to keep things cohesive
    if not any(p.text.lower() == "ambient" for p in prompts):
        prompts.append(WeightedPrompt(text="Ambient", weight=0.5))
    
    # Analyze description for mood parameters
    mood_config = _analyze_description_mood(description)
    
    # Limit to 5 prompts max
    prompts = prompts[:5]
    
    return prompts, mood_config


def get_recommended_bpm(subjects: Optional[list[str]] = None) -> int:
    """
    Get a recommended BPM based on book subjects.
    Returns a value between 60-120 for ambient/reading music.
    """
    if not subjects:
        return 80
    
    subjects_lower = [s.lower() for s in subjects]
    
    # Fast-paced genres
    fast_keywords = ["action", "thriller", "adventure", "sports", "exciting"]
    if any(kw in " ".join(subjects_lower) for kw in fast_keywords):
        return 100
    
    # Slow/contemplative genres
    slow_keywords = ["meditation", "philosophy", "poetry", "peaceful", "spiritual"]
    if any(kw in " ".join(subjects_lower) for kw in slow_keywords):
        return 65
    
    # Medium pace for most genres
    return 80
