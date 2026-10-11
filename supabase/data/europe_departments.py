"""Departments of the best-known European universities (phase E1 rows), user request 2026-10-11.

The unit a student says they belong to (department / school / faculty, as the university names it), English names.
Years = undergraduate years of that unit's usual degree: England / Wales 3, integrated masters (MEng, MSci, MPhys,
MChem, MMath) and year-abroad language degrees 4; Scotland one more (4, integrated masters 5); Ireland 4; medicine
5–6, dentistry / veterinary 5 (the CHECK allows 1–6). Master's / PhD (8 / 9) are offered everywhere by the app.
A student whose unit is missing picks "I can't find my department". Run:
  python3 supabase/data/europe_departments.py > supabase/migrations/<ts>_europe_departments_<batch>.sql

Each university: (default years, lines "slug | Name | Short | years"); Short / years may be left empty.
"""

import re
import sys

UK_IE = {
    "oxford": (3, """
        classics | Classics | | 4
        english | English Language and Literature | English
        history | History | |
        art-history | History of Art | Art History
        linguistics | Linguistics, Philology and Phonetics | Linguistics
        languages | Medieval and Modern Languages | Modern Languages | 4
        music | Music | |
        asian | Asian and Middle Eastern Studies | Asian & Middle Eastern | 4
        philosophy | Philosophy | |
        theology | Theology and Religion | Theology
        ruskin | Ruskin School of Art | Fine Art
        chemistry | Chemistry | | 4
        cs | Computer Science | | 4
        earth | Earth Sciences | | 4
        engineering | Engineering Science | Engineering | 4
        materials | Materials | | 4
        maths | Mathematics | | 4
        physics | Physics | | 4
        statistics | Statistics | | 4
        biology | Biology | | 4
        biochem | Biochemistry | | 4
        medicine | Medicine | | 6
        biomed | Biomedical Sciences | Biomedical Sciences
        psychology | Experimental Psychology | Psychology
        archaeology | Archaeology | |
        anthropology | Anthropology and Museum Ethnography | Anthropology
        economics | Economics | |
        education | Education | |
        geography | Geography and the Environment | Geography
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        said | Saïd Business School | Business
        blavatnik | Blavatnik School of Government | Government
        socialpolicy | Social Policy and Intervention | Social Policy
        sociology | Sociology | |
        internet | Oxford Internet Institute | Internet Institute
        intdev | International Development | Int. Development
    """),
    "cambridge": (3, """
        archaeology | Archaeology | |
        architecture | Architecture | |
        asian | Asian and Middle Eastern Studies | Asian & Middle Eastern | 4
        classics | Classics | |
        cs | Computer Science and Technology | Computer Science | 4
        economics | Economics | |
        education | Education | |
        engineering | Engineering | | 4
        chemeng | Chemical Engineering and Biotechnology | Chemical Engineering | 4
        english | English | |
        geography | Geography | |
        history | History | |
        art-history | History of Art | Art History
        hsps | Human, Social, and Political Science | HSPS
        landecon | Land Economy | |
        law | Law | |
        linguistics | Linguistics | |
        maths | Mathematics | | 4
        medicine | Medicine | | 6
        languages | Modern and Medieval Languages | Modern Languages | 4
        music | Music | |
        natsci | Natural Sciences | | 4
        philosophy | Philosophy | |
        psychology | Psychological and Behavioural Sciences | Psychology
        theology | Theology, Religion and Philosophy of Religion | Theology
        vet | Veterinary Medicine | | 6
        judge | Judge Business School | Business
    """),
    "imperial": (4, """
        aero | Aeronautics | |
        bioeng | Bioengineering | |
        chemeng | Chemical Engineering | |
        civil | Civil and Environmental Engineering | Civil Engineering
        computing | Computing | |
        design | Dyson School of Design Engineering | Design Engineering
        earth | Earth Science and Engineering | Earth Science
        eee | Electrical and Electronic Engineering | EEE
        materials | Materials | |
        mech | Mechanical Engineering | |
        chemistry | Chemistry | |
        maths | Mathematics | |
        physics | Physics | |
        life | Life Sciences | |
        medicine | Medicine | | 6
        business | Imperial Business School | Business | 3
    """),
    "ucl": (3, """
        anthropology | Anthropology | |
        archaeology | Institute of Archaeology | Archaeology
        bartlett | Bartlett School of Architecture | Architecture
        planning | Bartlett School of Planning | Planning
        construction | Bartlett School of Sustainable Construction | Construction
        biochemeng | Biochemical Engineering | | 4
        biosciences | Biosciences | |
        chemeng | Chemical Engineering | | 4
        chemistry | Chemistry | | 4
        civil | Civil, Environmental and Geomatic Engineering | Civil Engineering | 4
        cs | Computer Science | | 4
        earth | Earth Sciences | | 4
        economics | Economics | |
        eee | Electronic and Electrical Engineering | EEE | 4
        english | English Language and Literature | English
        selcs | European Languages, Culture and Society | SELCS | 4
        geography | Geography | |
        greeklatin | Greek and Latin | |
        hebrew | Hebrew and Jewish Studies | |
        history | History | |
        art-history | History of Art | Art History
        information | Information Studies | |
        ioe | IOE, Faculty of Education and Society | Education
        laws | Laws | |
        maths | Mathematics | | 4
        mech | Mechanical Engineering | | 4
        medphys | Medical Physics and Biomedical Engineering | Biomedical Engineering | 4
        medicine | Medical School | Medicine | 6
        management | School of Management | Management
        natsci | Natural Sciences | | 4
        pharmacy | School of Pharmacy | Pharmacy | 4
        philosophy | Philosophy | |
        physics | Physics and Astronomy | Physics | 4
        politics | Political Science | Politics
        psychology | Psychology and Language Sciences | Psychology
        slade | Slade School of Fine Art | Fine Art | 4
        ssees | School of Slavonic and East European Studies | SSEES | 4
        stats | Statistical Science | Statistics
        basc | Arts and Sciences (BASc) | Arts & Sciences | 4
    """),
    "kcl": (3, """
        classics | Classics | |
        complit | Comparative Literature | |
        digital | Digital Humanities | |
        english | English | |
        film | Film Studies | |
        languages | Languages, Literatures and Cultures | Languages | 4
        history | History | |
        music | Music | |
        philosophy | Philosophy | |
        theology | Theology and Religious Studies | Theology
        war | War Studies | |
        geography | Geography | |
        poleco | Political Economy | |
        eis | European and International Studies | European & Int. Studies | 4
        education | Education, Communication and Society | Education
        globalhealth | Global Health and Social Medicine | Global Health
        intdev | International Development | Int. Development
        cmci | Culture, Media and Creative Industries | Culture & Media
        business | King's Business School | Business
        law | Dickson Poon School of Law | Law
        dentistry | Dentistry | | 5
        medicine | GKT School of Medical Education | Medicine | 5
        biosciences | Life Sciences (Biosciences) | Biosciences
        pharmacy | Pharmacy | | 4
        nutrition | Nutritional Sciences | Nutrition
        nursing | Nursing and Midwifery | Nursing
        physio | Physiotherapy | |
        psychology | Psychology | |
        neuroscience | Neuroscience | |
        chemistry | Chemistry | | 4
        engineering | Engineering | | 4
        informatics | Informatics | Computer Science | 4
        maths | Mathematics | | 4
        physics | Physics | | 4
    """),
    "edinburgh": (4, """
        eca | Edinburgh College of Art | Art & Design
        architecture | Architecture and Landscape Architecture | Architecture | 5
        music | Music | |
        business | Business School | Business
        divinity | Divinity | |
        economics | Economics | |
        moray | Education and Sport (Moray House) | Education
        health | Health in Social Science | Health
        hca | History, Classics and Archaeology | History & Classics
        law | Law | |
        llc | Literatures, Languages and Cultures | Languages | 5
        ppls | Philosophy, Psychology and Language Sciences | PPLS
        sps | Social and Political Science | Social & Political Science
        medicine | Edinburgh Medical School | Medicine | 6
        biomed | Biomedical Sciences | |
        vet | Royal (Dick) School of Veterinary Studies | Veterinary | 5
        biology | Biological Sciences | Biology
        chemistry | Chemistry | | 5
        engineering | Engineering | | 5
        geosciences | GeoSciences | |
        informatics | Informatics | | 5
        maths | Mathematics | | 5
        physics | Physics and Astronomy | Physics | 5
    """),
    "manchester": (3, """
        biology | Biological Sciences | Biology
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        pharmacy | Pharmacy | | 4
        nursing | Nursing, Midwifery and Social Work | Nursing
        psychology | Psychology | |
        chemeng | Chemical Engineering | | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        mace | Mechanical, Aerospace and Civil Engineering | MACE | 4
        chemistry | Chemistry | | 4
        earth | Earth and Environmental Sciences | Earth Sciences | 4
        physics | Physics and Astronomy | Physics | 4
        materials | Materials | | 4
        maths | Mathematics | | 4
        archaeology | Archaeology | |
        art-history | Art History and Visual Studies | Art History
        classics | Classics and Ancient History | Classics
        drama | Drama | |
        english | English and American Studies | English
        history | History | |
        linguistics | Linguistics and English Language | Linguistics
        languages | Modern Languages and Cultures | Modern Languages | 4
        music | Music | |
        religions | Religions and Theology | Theology
        geography | Geography | |
        planning | Planning and Environmental Management | Planning
        architecture | Manchester School of Architecture | Architecture
        education | Education | |
        law | Law | |
        criminology | Criminology | |
        economics | Economics | |
        politics | Politics | |
        sociology | Sociology | |
        philosophy | Philosophy | |
        anthropology | Social Anthropology | Anthropology
        business | Alliance Manchester Business School | Business
    """),
    "bristol": (3, """
        anthropology | Anthropology and Archaeology | Anthropology & Archaeology
        classics | Classics and Ancient History | Classics
        english | English | |
        film | Film and Television | Film & TV
        history | History | |
        art-history | History of Art | Art History
        languages | Modern Languages | | 4
        music | Music | |
        philosophy | Philosophy | |
        theology | Religion and Theology | Theology
        theatre | Theatre | |
        aero | Aerospace Engineering | | 4
        civil | Civil Engineering | | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        engmaths | Engineering Mathematics | | 4
        mech | Mechanical Engineering | | 4
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        vet | Veterinary Science | | 5
        biochem | Biochemistry | |
        biology | Biological Sciences | Biology
        cmm | Cellular and Molecular Medicine | Cellular & Molecular Medicine
        ppn | Physiology, Pharmacology and Neuroscience | Physiology & Neuroscience
        psychology | Psychological Science | Psychology
        chemistry | Chemistry | | 4
        earth | Earth Sciences | | 4
        geography | Geographical Sciences | Geography
        maths | Mathematics | | 4
        physics | Physics | | 4
        business | Business School | Business
        economics | Economics | |
        education | Education | |
        law | Law | |
        policy | Policy Studies | |
        spais | Sociology, Politics and International Studies | SPAIS
    """),
    "warwick": (3, """
        chemistry | Chemistry | | 4
        cs | Computer Science | | 4
        engineering | Engineering | | 4
        life | Life Sciences | |
        maths | Mathematics | | 4
        physics | Physics | | 4
        statistics | Statistics | | 4
        psychology | Psychology | |
        medicine | Warwick Medical School | Medicine | 4
        economics | Economics | |
        law | Law | |
        pais | Politics and International Studies | Politics & IR
        philosophy | Philosophy | |
        sociology | Sociology | |
        education | Education Studies | Education
        wbs | Warwick Business School | Business
        english | English and Comparative Literary Studies | English
        history | History | |
        art-history | History of Art | Art History
        classics | Classics and Ancient History | Classics
        film | Film and Television Studies | Film & TV
        theatre | Theatre and Performance Studies | Theatre
        languages | Modern Languages and Cultures | Modern Languages | 4
        liberal | Liberal Arts | |
        gsd | Global Sustainable Development | Sustainable Development
    """),
    "glasgow": (4, """
        critical | Critical Studies (English, Scottish Literature) | English & Literature
        ccpa | Culture and Creative Arts | Creative Arts
        humanities | Humanities (History, Classics, Archaeology, Philosophy, Theology) | Humanities
        languages | Modern Languages and Cultures | Modern Languages | 5
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        vet | Veterinary Medicine | | 5
        biosciences | Molecular Biosciences | Biosciences
        life | Life Sciences | |
        psychology | Psychology and Neuroscience | Psychology
        chemistry | Chemistry | | 5
        computing | Computing Science | | 5
        engineering | Engineering | | 5
        ges | Geographical and Earth Sciences | Geography & Earth Sciences
        maths | Mathematics and Statistics | Mathematics | 5
        physics | Physics and Astronomy | Physics | 5
        business | Adam Smith Business School | Business
        education | Education | |
        law | Law | |
        sps | Social and Political Sciences | Social & Political Sciences
        dumfries | Interdisciplinary Studies (Dumfries) | Dumfries
    """),
    "durham": (3, """
        anthropology | Anthropology | |
        archaeology | Archaeology | |
        biosciences | Biosciences | |
        business | Business School | Business
        chemistry | Chemistry | | 4
        classics | Classics and Ancient History | Classics
        cs | Computer Science | | 4
        earth | Earth Sciences | | 4
        economics | Economics and Finance | Economics
        education | Education | |
        engineering | Engineering | | 4
        english | English Studies | English
        geography | Geography | |
        sgia | Government and International Affairs | Government & IR
        history | History | |
        law | Law | |
        maths | Mathematical Sciences | Mathematics | 4
        languages | Modern Languages and Cultures | Modern Languages | 4
        music | Music | |
        natsci | Natural Sciences | | 4
        philosophy | Philosophy | |
        physics | Physics | | 4
        psychology | Psychology | |
        sociology | Sociology | |
        sport | Sport and Exercise Sciences | Sport
        theology | Theology and Religion | Theology
    """),
    "standrews": (4, """
        art-history | Art History | |
        biology | Biology | |
        chemistry | Chemistry | | 5
        classics | Classics | |
        cs | Computer Science | | 5
        divinity | Divinity | |
        earth | Earth and Environmental Sciences | Earth Sciences
        economics | Economics and Finance | Economics
        english | English | |
        film | Film Studies | |
        geography | Geography and Sustainable Development | Geography
        history | History | |
        ir | International Relations | |
        management | Management | |
        maths | Mathematics and Statistics | Mathematics | 5
        medicine | Medicine | | 3
        languages | Modern Languages | | 5
        philosophy | Philosophy | |
        physics | Physics and Astronomy | Physics | 5
        psychology | Psychology and Neuroscience | Psychology
        anthropology | Social Anthropology | Anthropology
    """),
    "southampton": (3, """
        aero | Aeronautics and Astronautics | Aeronautics | 4
        civil | Civil, Maritime and Environmental Engineering | Civil Engineering | 4
        ecs | Electronics and Computer Science | ECS | 4
        mech | Mechanical Engineering | | 4
        chemistry | Chemistry | | 4
        maths | Mathematical Sciences | Mathematics | 4
        physics | Physics and Astronomy | Physics | 4
        ocean | Ocean and Earth Science | Ocean & Earth | 4
        biology | Biological Sciences | Biology
        medicine | Medicine | | 5
        health | Health Sciences | |
        psychology | Psychology | |
        geography | Geography and Environmental Science | Geography
        business | Southampton Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        sociology | Sociology, Social Policy and Criminology | Sociology
        education | Education | |
        art | Winchester School of Art | Art & Design
        english | English | |
        history | History | |
        archaeology | Archaeology | |
        film | Film | |
        languages | Modern Languages and Linguistics | Modern Languages | 4
        music | Music | |
        philosophy | Philosophy | |
    """),
    "leeds": (3, """
        biology | Biology | |
        biomed | Biomedical Sciences | |
        chemistry | Chemistry | | 4
        civil | Civil Engineering | | 4
        chemeng | Chemical and Process Engineering | Chemical Engineering | 4
        computing | Computing | | 4
        eee | Electronic and Electrical Engineering | EEE | 4
        mech | Mechanical Engineering | | 4
        maths | Mathematics | | 4
        physics | Physics and Astronomy | Physics | 4
        earth | Earth and Environment | |
        food | Food Science and Nutrition | Food Science
        geography | Geography | |
        psychology | Psychology | |
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        healthcare | Healthcare (Nursing, Midwifery) | Healthcare
        business | Leeds University Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Studies | Politics & IR
        sociology | Sociology and Social Policy | Sociology
        education | Education | |
        media | Media and Communication | Media
        english | English | |
        history | History | |
        prhs | Philosophy, Religion and History of Science | Philosophy
        fine-art | Fine Art, History of Art and Cultural Studies | Fine Art & Art History
        design | Design | |
        languages | Languages, Cultures and Societies | Languages | 4
        music | Music | |
        pci | Performance and Cultural Industries | Performance
    """),
    "birmingham": (3, """
        biosciences | Biosciences | |
        chemistry | Chemistry | | 4
        chemeng | Chemical Engineering | | 4
        civil | Civil Engineering | | 4
        cs | Computer Science | | 4
        eese | Electronic, Electrical and Systems Engineering | EEE | 4
        mech | Mechanical Engineering | | 4
        materials | Metallurgy and Materials | Materials | 4
        maths | Mathematics | | 4
        physics | Physics and Astronomy | Physics | 4
        gees | Geography, Earth and Environmental Sciences | Geography & Earth Sciences
        psychology | Psychology | |
        sport | Sport, Exercise and Rehabilitation Sciences | Sport
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        pharmacy | Pharmacy | | 4
        nursing | Nursing | |
        business | Birmingham Business School | Business
        economics | Economics | |
        law | Birmingham Law School | Law
        government | Government (Politics and International Relations) | Politics & IR
        socialpolicy | Social Policy, Sociology and Criminology | Social Policy
        education | Education | |
        english | English, Drama and Creative Studies | English & Drama
        history | History and Cultures | History
        ptr | Philosophy, Theology and Religion | Philosophy & Theology
        lcahm | Languages, Cultures, Art History and Music | Languages & Arts | 4
    """),
    "sheffield": (3, """
        architecture | Architecture | |
        planning | Urban Studies and Planning | Planning
        biosciences | Biosciences | |
        chemistry | Chemistry | | 4
        chemeng | Chemical, Materials and Biological Engineering | Chemical Engineering | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        mac | Mechanical, Aerospace and Civil Engineering | Mech., Aero & Civil Eng. | 4
        maths | Mathematics and Statistics | Mathematics | 4
        physics | Physics and Astronomy | Physics | 4
        geography | Geography | |
        psychology | Psychology | |
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        health | Health Sciences | |
        management | Sheffield University Management School | Management
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        sociology | Sociological Studies | Sociology
        education | Education | |
        journalism | Journalism Studies | Journalism
        information | Information School | Information
        english | English | |
        history | History | |
        philosophy | Philosophy | |
        languages | Languages and Cultures | Languages | 4
        music | Music | |
        archaeology | Archaeology | |
        eas | East Asian Studies | East Asian Studies | 4
    """),
    "nottingham": (3, """
        biosciences | Biosciences | |
        chemistry | Chemistry | | 4
        chemeng | Chemical and Environmental Engineering | Chemical Engineering | 4
        civil | Civil Engineering | | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        m3 | Mechanical, Materials and Manufacturing Engineering | Mechanical Engineering | 4
        architecture | Architecture and Built Environment | Architecture
        maths | Mathematical Sciences | Mathematics | 4
        physics | Physics and Astronomy | Physics | 4
        pharmacy | Pharmacy | | 4
        life | Life Sciences | |
        medicine | Medicine | | 5
        vet | Veterinary Medicine and Science | Veterinary | 5
        health | Health Sciences | |
        psychology | Psychology | |
        business | Nottingham University Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        sociology | Sociology and Social Policy | Sociology
        education | Education | |
        geography | Geography | |
        english | English | |
        history | History | |
        classics | Classics and Archaeology | Classics
        philosophy | Philosophy | |
        music | Music | |
        theology | Theology and Religious Studies | Theology
        languages | Cultures, Languages and Area Studies | Languages | 4
    """),
    "qmul": (3, """
        sbbs | Biological and Behavioural Sciences | Biology & Psychology
        spcs | Physical and Chemical Sciences | Physics & Chemistry | 4
        eecs | Electronic Engineering and Computer Science | EECS | 4
        sems | Engineering and Materials Science | Engineering | 4
        maths | Mathematical Sciences | Mathematics | 4
        geography | Geography | |
        medicine | Barts and The London School of Medicine | Medicine | 5
        dentistry | Dentistry | | 5
        business | Business and Management | Business
        economics | Economics and Finance | Economics
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        english | English and Drama | English & Drama
        history | History | |
        sllf | Languages, Linguistics and Film | Languages & Film | 4
    """),
    "bath": (4, """
        ace | Architecture and Civil Engineering | Architecture & Civil Eng.
        chemeng | Chemical Engineering | |
        eee | Electronic and Electrical Engineering | EEE
        mech | Mechanical Engineering | |
        biology | Life Sciences (Biology and Biochemistry) | Biology
        chemistry | Chemistry | |
        cs | Computer Science | |
        maths | Mathematical Sciences | Mathematics
        natsci | Natural Sciences | |
        physics | Physics | |
        pharmacy | Pharmacy and Pharmacology | Pharmacy
        psychology | Psychology | |
        health | Health (Sport and Exercise Science) | Sport & Health
        management | School of Management | Management
        economics | Economics | |
        polis | Politics, Languages and International Studies | Politics & Languages
        sps | Social and Policy Sciences | Social Sciences
        education | Education | |
    """),
    "exeter": (3, """
        business | University of Exeter Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        spa | Sociology, Philosophy and Anthropology | Sociology & Philosophy
        archaeology | Archaeology and History | History & Archaeology
        classics | Classics, Ancient History, Religion and Theology | Classics & Theology
        english | English and Film | English & Film
        languages | Modern Languages and Cultures | Modern Languages | 4
        arabic | Arab and Islamic Studies | Arab & Islamic Studies | 4
        drama | Drama | |
        psychology | Psychology | |
        sport | Sport and Health Sciences | Sport
        medicine | Medicine | | 5
        biosciences | Biosciences | |
        geography | Geography | |
        csm | Camborne School of Mines (Earth and Environmental Sciences) | Earth Sciences
        engineering | Engineering | | 4
        cs | Computer Science | | 4
        maths | Mathematics | | 4
        natsci | Natural Sciences | | 4
        physics | Physics and Astronomy | Physics | 4
        education | Education | |
    """),
    "york": (3, """
        archaeology | Archaeology | |
        biology | Biology | |
        chemistry | Chemistry | | 4
        cs | Computer Science | | 4
        economics | Economics and Related Studies | Economics
        education | Education | |
        engineering | Physics, Engineering and Technology | Engineering | 4
        english | English and Related Literature | English
        environment | Environment and Geography | Geography
        health | Health Sciences | |
        history | History | |
        art-history | History of Art | Art History
        language | Language and Linguistic Science | Linguistics
        law | Law | |
        management | Management | |
        maths | Mathematics | | 4
        medicine | Hull York Medical School | Medicine | 5
        music | Music | |
        philosophy | Philosophy | |
        physics | Physics | | 4
        politics | Politics | |
        psychology | Psychology | |
        socialpolicy | Social Policy and Social Work | Social Policy
        sociology | Sociology | |
        tfti | Arts and Creative Technologies (Theatre, Film, Television) | Theatre, Film & TV
    """),
    "lancaster": (3, """
        management | Management School | Management
        economics | Economics | |
        law | Law | |
        ppr | Politics, Philosophy and Religion | Politics & Philosophy
        sociology | Sociology | |
        linguistics | Linguistics and English Language | Linguistics
        english | English Literature and Creative Writing | English
        history | History | |
        languages | Languages and Cultures | Languages | 4
        lica | Contemporary Arts (Art, Design, Film, Music, Theatre) | Arts
        psychology | Psychology | |
        education | Educational Research | Education
        biomed | Biomedical and Life Sciences | Life Sciences
        medicine | Medicine | | 5
        health | Health and Medicine | Health
        chemistry | Chemistry | | 4
        computing | Computing and Communications | Computing | 4
        engineering | Engineering | | 4
        maths | Mathematics and Statistics | Mathematics | 4
        physics | Physics | | 4
        lec | Lancaster Environment Centre | Environment
    """),
    "cityuol": (3, """
        bayes | Bayes Business School | Business
        law | The City Law School | Law
        economics | Economics | |
        politics | International Politics | Politics & IR
        sociology | Sociology and Criminology | Sociology
        journalism | Journalism | |
        music | Music | |
        psychology | Psychology | |
        nursing | Nursing and Midwifery | Nursing
        optometry | Optometry | |
        cs | Computer Science | |
        engineering | Engineering | | 4
        maths | Mathematics | |
        medicine | Medicine (St George's) | Medicine | 5
        biomed | Biomedical Science | |
        healthcare | Healthcare Sciences (Physiotherapy, Paramedic Science) | Healthcare Sciences
    """),
    "strathclyde": (4, """
        business | Strathclyde Business School | Business
        economics | Economics | |
        law | Law | |
        humanities | Humanities (English, History, Journalism) | Humanities
        languages | Modern Languages | | 5
        government | Government and Public Policy | Government
        psychology | Psychological Sciences and Health | Psychology
        socialwork | Social Work and Social Policy | Social Work
        education | Education | |
        architecture | Architecture | |
        biomedeng | Biomedical Engineering | | 5
        chemeng | Chemical and Process Engineering | Chemical Engineering | 5
        civil | Civil and Environmental Engineering | Civil Engineering | 5
        dmem | Design, Manufacture and Engineering Management | Design & Manufacture | 5
        eee | Electronic and Electrical Engineering | EEE | 5
        mech | Mechanical and Aerospace Engineering | Mechanical Engineering | 5
        naval | Naval Architecture, Ocean and Marine Engineering | Naval Architecture | 5
        cis | Computer and Information Sciences | Computer Science
        maths | Mathematics and Statistics | Mathematics
        physics | Physics | | 5
        chemistry | Pure and Applied Chemistry | Chemistry | 5
        sipbs | Pharmacy and Biomedical Sciences | Pharmacy | 5
    """),
    "tcd": (4, """
        business | Trinity Business School | Business
        law | Law | |
        economics | Economics | |
        politics | Political Science | Politics
        sociology | Sociology | |
        philosophy | Philosophy | |
        pps | Philosophy, Political Science, Economics and Sociology (PPES) | PPES
        psychology | Psychology | |
        education | Education | |
        socialwork | Social Work and Social Policy | Social Work
        english | English | |
        histories | Histories and Humanities (History, Classics) | History & Classics
        languages | Languages, Literatures and Cultural Studies | Languages
        slscs | Linguistic, Speech and Communication Sciences | Linguistics
        creative | Creative Arts (Drama, Film, Music) | Creative Arts
        religion | Religion, Theology and Peace Studies | Theology
        engineering | Engineering | | 5
        cs | Computer Science and Statistics | Computer Science | 5
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        natsci | Natural Sciences | |
        biochem | Biochemistry and Immunology | Biochemistry
        genetics | Genetics and Microbiology | Genetics
        medicine | Medicine | | 6
        dental | Dental Science | Dentistry | 5
        pharmacy | Pharmacy and Pharmaceutical Sciences | Pharmacy | 5
        nursing | Nursing and Midwifery | Nursing
    """),
    "ucd": (4, """
        agriculture | Agriculture and Food Science | Agriculture
        architecture | Architecture, Planning and Environmental Policy | Architecture | 5
        art-history | Art History and Cultural Policy | Art History
        biology | Biology and Environmental Science | Biology
        biomed | Biomolecular and Biomedical Science | Biomedical Science
        biosystems | Biosystems and Food Engineering | Biosystems Engineering | 5
        chemeng | Chemical and Bioprocess Engineering | Chemical Engineering | 5
        chemistry | Chemistry | |
        civil | Civil Engineering | | 5
        classics | Classics | |
        cs | Computer Science | |
        economics | Economics | |
        education | Education | |
        eee | Electrical and Electronic Engineering | EEE | 5
        english | English, Drama and Film | English
        geography | Geography | |
        history | History | |
        information | Information and Communication Studies | Information Studies
        irish | Irish, Celtic Studies and Folklore | Irish Studies
        languages | Languages, Cultures and Linguistics | Languages
        law | Sutherland School of Law | Law
        maths | Mathematics and Statistics | Mathematics
        mech | Mechanical and Materials Engineering | Mechanical Engineering | 5
        medicine | Medicine | | 6
        music | Music | |
        nursing | Nursing, Midwifery and Health Systems | Nursing
        philosophy | Philosophy | |
        physics | Physics | |
        politics | Politics and International Relations | Politics & IR
        psychology | Psychology | |
        public-health | Public Health, Physiotherapy and Sports Science | Public Health & Sport
        socialpolicy | Social Policy, Social Work and Social Justice | Social Policy
        sociology | Sociology | |
        vet | Veterinary Medicine | | 5
        business | Quinn School of Business | Business
    """),
}

BATCHES = {"uk_ie": UK_IE}


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def parse(uni: str, default: int, block: str):
    rows = []
    for line in block.strip().splitlines():
        parts = [p.strip() for p in line.split("|")] + ["", ""]
        slug, name, short, years = parts[0], parts[1], parts[2] or parts[1], parts[3]
        dep_id = f"{uni}-{slug}"
        assert re.fullmatch(r"[a-z0-9_-]{2,40}", dep_id), dep_id
        y = int(years) if years else default
        assert 1 <= y <= 6, (dep_id, y)
        rows.append((dep_id, name, short, y))
    assert len({r[0] for r in rows}) == len(rows), f"duplicate slug in {uni}"
    return rows


def sql(batch: dict) -> str:
    out = [
        "-- Generated by supabase/data/europe_departments.py: departments of the best-known European universities",
        "-- (English names in both languages, like LSE / USC). Existing ids are left alone.",
        "INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES",
    ]
    values = []
    for uni, (default, block) in batch.items():
        for pos, (dep_id, name, short, y) in enumerate(parse(uni, default, block), 1):
            values.append(f"  ({q(dep_id)}, {q(uni)}, {q(name)}, {q(name)}, {q(short)}, {q(short)}, {y}, {pos})")
    out.append(",\n".join(values))
    out.append("ON CONFLICT (id) DO NOTHING;")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    print(sql(BATCHES[sys.argv[1] if len(sys.argv) > 1 else "uk_ie"]), end="")
